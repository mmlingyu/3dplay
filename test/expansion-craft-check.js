import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const browser=await chromium.launch({headless:true});
try{
  for(const [name,width,height,touch] of [['desktop',1440,900,false],['phone',390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.GAME_TEST_URL||'http://127.0.0.1:5173');
    await page.waitForFunction(()=>window.__valley?.world);
    assert.ok(await page.locator('#land-button').count(),'开垦入口存在');
    await page.locator('#start-button').click();
    await page.locator('#life-button').click();await page.waitForSelector('.large-clock svg');
    assert.equal(await page.locator('.large-clock [data-clock-hand]').count(),2);
    await page.screenshot({path:join(tmpdir(),`valley-clock-${name}.png`)});
    await page.evaluate(()=>__valley.panels.close());
    await page.evaluate(()=>{const w=__valley.world;w.playerPosition.set(15.2,0,3);w.stopWalking();w.updateCamera(0,true);w.update(0,{},false);});
    await page.locator('#land-button').click();
    await page.locator('[data-action="land-open"][data-cx="2"][data-cz="0"]').click();
    assert.ok(await page.evaluate(()=>__valley.world.chunkGroups.has('2,0')));
    await page.evaluate(()=>__valley.panels.close());
    const encounter=await page.evaluate(()=>{
      const w=__valley.world,t=w.targets.find(t=>t.type==='encounter');
      w.playerPosition.set(t.position.x-1,0,t.position.z+1);w.updateCamera(0,true);w.update(0,{},false);
      return {id:t.id,name:t.name,x:t.position.x,z:t.position.z};
    });
    await page.getByRole('button',{name:`前往${encounter.name}`,exact:true}).click();
    await page.waitForFunction(id=>__valley.game.state.land.claimed.includes(id),encounter.id);
    const rewarded=await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory));
    await page.getByRole('button',{name:`前往${encounter.name}`,exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory)),rewarded);
    assert.ok(await page.evaluate(()=>__valley.game.placeBlock('plank',{x:17,z:1,y:0}).ok));
    await page.evaluate(()=>{const w=__valley.world;w.releaseBall({x:17,z:1});w.updateBalls(.1);});
    assert.ok(await page.evaluate(()=>__valley.world.balls.some(b=>b.p.x>16)));
    await page.screenshot({path:join(tmpdir(),`valley-newland-${name}.png`)});
    await page.evaluate(()=>__valley.openPanel('pause'));await page.reload();
    await page.waitForFunction(()=>window.__valley?.world);
    assert.ok(await page.evaluate(()=>__valley.game.state.land.claimed.length===1&&__valley.world.chunkGroups.has('2,0')));
    await page.locator('#start-button').click();
    await page.locator('#craft-button').click();
    await page.locator('[data-action="workshop-flat"]').click();
    await page.locator('[data-action="workshop-want"][data-recipe="ball"]').click();
    const balls=await page.evaluate(()=>__valley.game.state.inventory.ball);
    await page.locator('[data-action="craft-goal"][data-recipe="ball"]').click();
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.ball),balls+1);
    await page.locator('[data-action="craft-clear"]').click();
    const woodBefore=await page.evaluate(()=>__valley.game.state.inventory.wood);
    const source=page.locator('[data-action="craft-material"][data-item="wood"]'),slot=page.locator('[data-action="craft-slot"][data-x="0"][data-y="0"]');
    await slot.scrollIntoViewIfNeeded();
    const a=await source.boundingBox(),b=await slot.boundingBox();
    assert.ok(a.y>=0&&a.y+a.height<=height,'材料和格子同时可见，便于拖放');
    if(touch){
      const cdp=await context.newCDPSession(page),point={x:a.x+a.width/2,y:a.y+a.height/2,id:0};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:b.x+b.width/2,y:b.y+b.height/2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    }else{
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
    }
    await page.waitForFunction(()=>document.querySelector('[data-action="craft-slot"][data-x="0"][data-y="0"]').textContent.includes('木料'));
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.wood),woodBefore);
    await page.screenshot({path:join(tmpdir(),`valley-craft-drag-${name}.png`)});
    await page.locator('[data-action="craft-confirm"]').click();
    assert.equal(await page.evaluate(()=>__valley.game.state.inventory.wood),woodBefore-1);
    for(const mode of ['outside','cancel',...(touch?['multitouch']:[]),'close']){
      await page.locator('[data-action="craft-clear"]').click();
      await slot.scrollIntoViewIfNeeded();
      const start=await source.boundingBox(),end=await slot.boundingBox();
      const from={x:start.x+start.width/2,y:start.y+start.height/2,id:0};
      const to={...from,x:end.x+end.width/2,y:end.y+end.height/2};
      const before=await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory));
      if(touch){
        const cdp=await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});
        if(mode==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        else{
          if(mode==='outside')await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,x:width/2,y:40}]});
          if(mode==='multitouch')await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[to,{x:width/2,y:40,id:1}]});
          if(mode==='close')await page.evaluate(()=>__valley.panels.close());
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }
        await cdp.detach();
      }else{
        await page.mouse.move(from.x,from.y);await page.mouse.down();
        await page.mouse.move(to.x,to.y,{steps:5});
        if(mode==='outside')await page.mouse.move(width/2,40);
        if(mode==='cancel')await source.dispatchEvent('pointercancel',{pointerId:1});
        if(mode==='close')await page.evaluate(()=>__valley.panels.close());
        await page.mouse.up();
      }
      if(mode==='close'){
        await page.locator('#craft-button').click();
        await page.locator('[data-action="workshop-flat"]').click();
      }
      assert.equal(await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory)),before,`${mode}不扣材料`);
      assert.equal(await page.locator('.craft-drag-ghost').count(),0,`${mode}清理拖动图标`);
      assert.equal(await page.locator('.craft-slot.drag-over').count(),0);
      assert.ok(!(await slot.textContent()).includes('木料'),`${mode}不写入试摆格子`);
    }
    await page.evaluate(()=>{
      __valley.panels.close();
      const {world:w,game:g}=__valley;
      w.playerPosition.set(-15.2,0,3);g.state.player={x:-15.2,y:0,z:3};g.reclaim(-3,0);
      w.playerPosition.set(15.2,0,-3);g.state.player={x:15.2,y:0,z:-3};g.reclaim(2,-1);
    });
    for(const kind of ['plant','animal','treasure']){
      const found=await page.evaluate(kind=>{
        const w=__valley.world,t=w.targets.find(t=>t.type==='encounter'&&t.kind===kind);
        w.playerPosition.set(t.position.x-1,0,t.position.z+1);w.stopWalking();w.updateCamera(0,true);w.update(0,{},false);
        return {id:t.id,name:t.name};
      },kind);
      assert.equal(await page.getByRole('button',{name:`前往${found.name}`,exact:true}).count(),1,'发现标签不重复');
      await page.screenshot({path:join(tmpdir(),`valley-discovery-${kind}-${name}.png`),style:'#toast-root, #wish-card { visibility: hidden !important; }'});
      await page.getByRole('button',{name:`前往${found.name}`,exact:true}).click();
      await page.waitForFunction(id=>__valley.game.state.land.claimed.includes(id),found.id);
      const before=await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory));
      await page.getByRole('button',{name:`前往${found.name}`,exact:true}).click();
      assert.equal(await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory)),before);
    }
    await page.evaluate(()=>__valley.openPanel('pause'));await page.reload();
    await page.waitForFunction(()=>window.__valley?.world);
    assert.equal(await page.evaluate(()=>__valley.game.state.land.claimed.length),3,'三类发现的领取记录重载保留');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(errors.length,0,errors.join('\n'));console.log(`${name}: 时钟、扩图、发现领取/重载、建造/木球、图卡与拖放通过`);
    await context.close();
  }
}finally{await browser.close();}
