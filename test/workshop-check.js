import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const browser=await chromium.launch({headless:true});
try{
  for(const [name,width,height,touch] of [['desktop',1440,900,false],['phone',390,844,true],['tablet',1024,768,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.GAME_TEST_URL||'http://127.0.0.1:5173');
    await page.waitForFunction(()=>window.__valley?.world);
    await page.locator('#start-button').click();
    await page.locator('#craft-button').click();
    assert.equal(await page.locator('#workshop-canvas').count(),1,'默认入口是实体工作台');
    await page.waitForFunction(()=>__valley.panels.workshop()?.ready);
    assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).panel),'workshop');
    if(width<520){
      const areas=await page.evaluate(()=>{
        const w=__valley.panels.workshop(),r=w.canvas.getBoundingClientRect();
        return ['material:wood','material:plank','lever:lever'].map(key=>{
          const g=w.targets.get(key),a=g.userData.hitArea,points=[];
          for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
            const p=g.position.clone().set(x,y,z);a.localToWorld(p);p.project(w.camera);
            points.push({x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2});
          }
          return {key,width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))};
        });
      });
      assert.ok(areas.every(a=>a.width>=44&&a.height>=44),`手机实体命中区至少44像素：${JSON.stringify(areas)}`);
    }
    const point=(kind,key)=>page.evaluate(([kind,key])=>__valley.panels.workshop().pointFor(kind,key),[kind,key]);
    const drag=async(a,b,mode='normal')=>{
      if(touch){
        const cdp=await context.newCDPSession(page),p={...a,id:0};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:0}]});
        if(mode==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        else{
          if(mode==='multitouch'||mode==='multi-ui')await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...b,id:0},mode==='multi-ui'?{x:width/2,y:20,id:1}:{x:a.x+15,y:a.y+15,id:1}]});
          if(mode==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
          if(mode==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
          if(mode==='close')await page.evaluate(()=>{window.previousWorkshop=__valley.panels.workshop();__valley.panels.close();});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }
        await cdp.detach();
      }else{
        await page.mouse.move(a.x,a.y);await page.mouse.down();
        await page.mouse.move(b.x,b.y,{steps:8});
        if(mode==='cancel')await page.locator('#workshop-canvas').dispatchEvent('pointercancel',{pointerId:1});
        if(mode==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
        if(mode==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
        if(mode==='close')await page.evaluate(()=>{window.previousWorkshop=__valley.panels.workshop();__valley.panels.close();});
        await page.mouse.up();
      }
      if(mode==='hidden')await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    };
    const before=await page.evaluate(()=>({...__valley.game.state.inventory}));
    await drag(await point('material','wood'),await point('slot','0,0'));
    assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.grid[0][0]),'wood');
    assert.deepEqual(await page.evaluate(()=>({...__valley.game.state.inventory})),before);
    const controlsVisible=await page.locator('[data-action="workshop-pull"]').evaluate(el=>{
      const r=el.getBoundingClientRect();
      return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;
    });
    assert.ok(controlsVisible,'制作备用按钮初始可见且无遮挡');
    await page.screenshot({path:join(tmpdir(),`valley-workshop-drag-${name}.png`)});
    const lever=await point('lever');
    await drag(lever,{x:lever.x,y:lever.y+10});
    assert.deepEqual(await page.evaluate(()=>({...__valley.game.state.inventory})),before,'短拉不制作');
    await drag(lever,{x:lever.x,y:lever.y+75});
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.wood),before.wood-1);
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.plank),before.plank+4);
    await page.screenshot({path:join(tmpdir(),`valley-workshop-result-${name}.png`)});
    const crafted=await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory));
    await drag(await point('lever'),{x:lever.x,y:lever.y+75});
    assert.equal(await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory)),crafted,'空台不重复发奖');
    for(const mode of ['cancel',...(touch?['multitouch','multi-ui']:[]),'hidden','blur','outside','close']){
      const a=await point('material','wood'),b=mode==='outside'?{x:width/2,y:20}:await point('slot','0,0');
      await drag(a,b,mode);
      if(mode==='close'){
        assert.equal(await page.evaluate(()=>previousWorkshop.disposed),true);
        await page.locator('#craft-button').click();await page.waitForFunction(()=>__valley.panels.workshop()?.ready);
      }
      assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.grid.flat().filter(Boolean).length),0,`${mode}不写入格子`);
      assert.equal(await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory)),crafted);
      assert.equal(await page.evaluate(()=>__valley.panels.workshop().drag),null);
    }
    await drag(await point('material','wood'),await point('slot','0,0'));
    await drag(await point('slot','0,0'),await point('slot','1,0'));
    assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.grid[0][1]),'wood','槽位之间移动');
    const filled=await point('slot','1,0');
    if(touch)await page.touchscreen.tap(filled.x,filled.y);else await page.mouse.click(filled.x,filled.y);
    assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.grid.flat().filter(Boolean).length),0,'点实体材料拿回');
    for(const [x,y] of [[0,0],[1,0]])await drag(await point('material','plank'),await point('slot',`${x},${y}`));
    assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.snapshot().selectedRecipe),'ball');
    assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.snapshot().ready),true,'两块木板只做木球');
    await drag(await point('lever'),{...(await point('lever')),y:(await point('lever')).y+75});
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.ball),before.ball+1);
    await page.locator('[data-action="workshop-flat"]').click();
    assert.equal(await page.locator('[data-action="craft-slot"]').count(),4,'二维备用保留');
    await page.evaluate(()=>{
      __valley.panels.close();const w=__valley.world,t=w.targets.find(t=>t.id==='public-workbench');
      w.playerPosition.set(t.position.x+1,0,t.position.z+1);w.stopWalking();__valley.interact(t);
    });
    await page.waitForFunction(()=>__valley.panels.workshop()?.ready);
    assert.equal(await page.evaluate(()=>__valley.panels.workshop().session.side),3);
    await page.locator('[data-action="workshop-goal"][data-recipe="chest"]').click();
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.chest),before.chest+1);
    await page.screenshot({path:join(tmpdir(),`valley-workshop-chest-${name}.png`)});
    await page.evaluate(()=>{window.previousWorkshop=__valley.panels.workshop();__valley.panels.close();});
    assert.equal(await page.evaluate(()=>previousWorkshop.disposed),true);
    await page.locator('#pause-button').click();await page.reload();
    await page.waitForFunction(()=>window.__valley?.world);
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.chest),before.chest+1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log(`${name}: 实体投料/拉杆/产物选择、取消、权限、二维备用与存档通过`);
    await context.close();
  }
}finally{await browser.close();}
