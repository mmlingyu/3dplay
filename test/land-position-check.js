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
    if (await page.locator('#wish-dismiss').isVisible()) await page.locator('#wish-dismiss').click();
    await page.locator('#map-toggle').click();
    await page.locator('#land-button').click();
    assert.equal(await page.locator('[data-action="land-open"]').count(),0,'原地没有远程开区入口');
    assert.ok((await page.locator('.panel-body').textContent()).includes('走到边界'));
    await page.locator('[data-action="close"]').first().click();
    const position=async x=>page.evaluate(x=>{
      const w=__valley.world;w.stopWalking();w.yaw=0;w.playerPosition.set(x,0,3);w.updateCamera(0,true);w.update(0,{},false);
    },x);
    const drive=async(dir,condition)=>{
      if(touch){
        const box=await page.locator('#joystick').boundingBox(),cdp=await context.newCDPSession(page);
        const center={x:box.x+box.width/2,y:box.y+box.height/2,id:0};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...center,x:center.x+dir*36}]});
        await page.waitForFunction(condition);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else{
        const key=dir>0?'d':'a';await page.keyboard.down(key);
        await page.waitForFunction(condition);await page.keyboard.up(key);
      }
    };
    await position(12.2);
    await drive(1,()=>!document.getElementById('land-question').hidden);
    const snapshot=JSON.parse(await page.evaluate(()=>render_game_to_text()));
    assert.equal(snapshot.landHint.id,'2,0');
    assert.equal(snapshot.land.opened.length,0,'靠近不自动开垦');
    assert.ok(await page.evaluate(()=>__valley.world.frontierPreview.visible));
    const open=page.locator('#land-question-open'),skip=page.locator('#land-question-skip');
    assert.ok(await open.boundingBox());
    assert.ok(await page.evaluate(()=>{
      for(const id of ['land-question-open','land-question-skip']){
        const b=document.getElementById(id),r=b.getBoundingClientRect();
        if(r.height<44||document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)!==b)return false;
      }
      const question=document.getElementById('land-question').getBoundingClientRect();
      for(const selector of ['.bottom-dock','#joystick','.action-controls']){
        const r=document.querySelector(selector).getBoundingClientRect();
        if(question.left<r.right&&question.right>r.left&&question.top<r.bottom&&question.bottom>r.top)return false;
      }
      if(getComputedStyle(document.getElementById('context-hint')).visibility!=='hidden')return false;
      return true;
    }),'引导按钮大且可命中');
    await page.screenshot({path:join(tmpdir(),`valley-land-boundary-${name}.png`)});
    await skip.click();
    await page.waitForFunction(()=>document.getElementById('land-question').hidden);
    assert.equal(await page.evaluate(()=>__valley.game.state.land.opened.length),0);
    await page.locator('#land-button').click();
    assert.equal(await page.locator('[data-action="land-open"]').count(),1,'面板仅显示就近地块');
    await position(10);
    await page.locator('[data-action="land-open"]').click();
    assert.equal(await page.evaluate(()=>__valley.game.state.land.opened.length),0,'提交时重新校验真实角色位置');
    await page.locator('[data-action="close"]').first().click();
    await drive(1,()=>!document.getElementById('land-question').hidden);
    await page.locator('#pause-button').click();
    await page.waitForFunction(()=>document.getElementById('land-question').hidden);
    assert.equal(await page.evaluate(()=>__valley.world.frontierPreview.visible),false);
    await page.locator('[data-action="close"]').first().click();
    await page.waitForFunction(()=>!document.getElementById('land-question').hidden);
    await page.locator('[data-item="plank"]').click();
    await page.waitForFunction(()=>document.getElementById('land-question').hidden);
    await page.locator('[data-mode="gather"]').click();
    await page.waitForFunction(()=>!document.getElementById('land-question').hidden);
    await drive(-1,()=>__valley.world.playerPosition.x<12.5);
    await page.waitForFunction(()=>document.getElementById('land-question').hidden);
    assert.equal(await page.evaluate(()=>__valley.world.frontierPreview.visible),false);
    await drive(1,()=>!document.getElementById('land-question').hidden);
    const before=await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory));
    await open.click();
    await page.waitForFunction(()=>__valley.game.state.land.opened.includes('2,0'));
    assert.equal(await page.evaluate(()=>JSON.stringify(__valley.game.state.inventory)),before);
    await page.waitForFunction(()=>document.getElementById('land-question').hidden);
    assert.ok(await page.evaluate(()=>__valley.world.canMove(17,3)));
    await position(22.9);
    await page.waitForFunction(()=>!document.getElementById('land-question').hidden);
    assert.equal(await page.locator('#land-question').getAttribute('data-chunk'),'3,0','新区边界继续探索');
    await page.locator('#pause-button').click();await page.reload();
    await page.waitForFunction(()=>window.__valley?.world);
    assert.equal(await page.evaluate(()=>__valley.game.state.land.opened.length),1);
    assert.equal(await page.evaluate(()=>document.getElementById('land-question').hidden),true,'未开始不提示');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log(`${name}: 角色边界引导、取消/重入、就近开区、即时校验与存档通过`);
    await context.close();
  }
}finally{await browser.close();}
