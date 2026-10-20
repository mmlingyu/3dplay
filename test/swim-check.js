import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height, touch] of [['desktop',1440,900,false],['tablet',1024,768,true],['phone',390,844,true]]) {
    const context = await browser.newContext({ viewport:{width,height}, hasTouch:touch });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(process.env.GAME_TEST_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(()=>window.__valley?.world);
    await page.locator('#start-button')[touch?'tap':'click']();
    const result = await page.evaluate(()=>{
      const w=__valley.world, render=w.renderer.render;
      w.renderer.render=()=>{}; __valley.game.state.settings.sound=false;
      const step=(n=80,input={})=>{for(let i=0;i<n;i++)w.update(.05,input,false);};
      try {
        w.playerPosition.set(4,-1,6); w.stopWalking(); step();
        const shallow=w.locomotion==='wade';
        w.playerPosition.set(4,.1,2.5); step();
        const bridge=w.locomotion==='walk';
        w.playerPosition.set(0,0,8.1); w.walkTo({x:0,z:11}); step(120);
        const entered=w.locomotion==='swim' && w.playerPosition.z>10;
        step(); const floating=Math.abs(w.playerPosition.y-.93)<.06;
        w.stopWalking();w.yaw=0;const swimX=w.playerPosition.x;step(1,{x:1,z:0});
        const swimSpeed=(w.playerPosition.x-swimX)/.05,slower=swimSpeed>1.9&&swimSpeed<2.2;
        const tilt=w.player.rotation.x;
        const arms=w.player.userData.arms.map(a=>a.position.z);step(5);
        const stroke=w.player.userData.arms.some((a,i)=>Math.abs(a.position.z-arms[i])>.02);
        const position=w.playerPosition.clone(), phase=w.motionTime;
        w.update(.1,{x:1,z:0},true);
        const paused=w.playerPosition.equals(position)&&w.motionTime===phase;
        w.yaw=0;w.playerPosition.set(0,.75,11);
        // Stop on the bank; a longer eastward walk enters the separate shallow river.
        step(20,{x:1,z:0});step(20);
        const exited=w.locomotion==='walk' && w.player.rotation.x<.05 && w.playerPosition.x>1.8;
        return {shallow,bridge,entered,floating,slower,stroke,paused,exited,tilt:tilt>.5};
      } finally {w.renderer.render=render;}
    });
    assert.ok(Object.values(result).every(Boolean),JSON.stringify(result));
    await page.evaluate(()=>{const w=__valley.world;w.playerPosition.set(0,.75,11);w.stopWalking();});
    await page.waitForFunction(()=>__valley.world.locomotion==='swim'&&__valley.world.playerPosition.y>.9);
    const startX=await page.evaluate(()=>__valley.world.playerPosition.x);
    if(touch){
      const cdp=await context.newCDPSession(page),r=await page.locator('#joystick').boundingBox();
      const center={x:r.x+r.width/2,y:r.y+r.height/2,id:0};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...center,x:center.x+25}]});
      await page.evaluate(()=>advanceTime(250));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    }else{
      await page.keyboard.down('d');await page.evaluate(()=>advanceTime(250));await page.keyboard.up('d');
    }
    assert.ok(await page.evaluate(x=>__valley.world.playerPosition.x>x+.03,startX),'真实键盘/摇杆输入可在水中移动');
    await page.screenshot({path:join(tmpdir(),`valley-swim-${name}.png`)});
    const text=JSON.parse(await page.evaluate(()=>render_game_to_text()));
    assert.equal(text.locomotion,'swim');
    await page.waitForFunction(()=>document.getElementById('action-name').textContent==='上岸');
    await page.locator('#action-button')[touch?'tap':'click']();
    const ashore=await page.evaluate(()=>{
      const w=__valley.world, render=w.renderer.render;w.renderer.render=()=>{};
      try{for(let i=0;i<120;i++)w.update(.05,{},false);return w.locomotion==='walk'&&w.playerPosition.z<9;}
      finally{w.renderer.render=render;}
    });
    assert.ok(ashore,'上岸按钮沿坡道离开深水');
    await page.evaluate(()=>{__valley.world.playerPosition.set(0,.93,11);__valley.world.stopWalking();});
    await page.waitForFunction(()=>__valley.world.locomotion==='swim');
    await page.evaluate(()=>__valley.openPanel('pause'));
    await page.reload();await page.waitForFunction(()=>window.__valley?.world);
    await page.locator('#start-button')[touch?'tap':'click']();
    await page.waitForFunction(()=>__valley.world.locomotion==='swim');
    const preserved = await page.evaluate(()=>{
      const game=__valley.game, value=JSON.parse(game.exportSave());
      value.blocks=[{id:'block-1',item:'plank',x:0,y:0,z:11,rotation:0}];
      const ok=game.importSave(JSON.stringify(value)).ok;
      return ok && !__valley.world.pool && game.state.blocks[0].z===11;
    });
    assert.ok(preserved,'旧建筑占泳池区域时保留建筑，不生成池体');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log(`${name}: 浅水、桥面、坡道入水、浮起泳姿、出岸、暂停、保存与旧建筑兼容通过`);
    await context.close();
  }
} finally {await browser.close();}
