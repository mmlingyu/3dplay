import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY } from '../src/game-data.js';

const browser=await chromium.launch({headless:true});
try {
  for(const [name,width,height] of [['tablet',1024,768],['phone',390,844]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.GAME_TEST_URL||'http://127.0.0.1:5173');
    await page.waitForFunction(()=>window.__valley?.world);
    assert.ok(await page.evaluate(()=>__valley.game.state.clock),'持久时钟存在');
    await page.locator('#start-button').tap();
    await page.locator('#life-button').tap();
    await page.waitForSelector('[data-panel="life"]');
    const growth=await page.evaluate(()=>{
      const {game,world}=__valley;game.tick(100);
      const id=game.state.flora[0].id,g=world.floraGroups.get(id),stage=g.userData.stage;
      game.tick(1);
      return {stage,same:g===world.floraGroups.get(id),count:world.floraGroups.size};
    });
    assert.equal(growth.stage,'flower');assert.ok(growth.same);assert.ok(growth.count>0);
    await page.waitForFunction(()=>document.querySelector('[data-panel="life"]').textContent.includes('蒲公英 · 开花'));
    await page.screenshot({path:join(tmpdir(),`valley-life-${name}.png`)});
    const elapsed=await page.evaluate(()=>__valley.game.state.clock.elapsed);
    await page.evaluate(()=>advanceTime(1400));
    assert.ok(await page.evaluate(n=>__valley.game.state.clock.elapsed>n,elapsed),'观察面板中继续成长');
    const hiddenTime=await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));return __valley.game.state.clock.elapsed;
    });
    await page.evaluate(()=>advanceTime(1400));
    assert.equal(await page.evaluate(()=>__valley.game.state.clock.elapsed),hiddenTime,'模拟隐藏状态不推进');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>__valley.openPanel('pause'));
    const paused=await page.evaluate(()=>__valley.game.exportSave());
    await page.evaluate(()=>advanceTime(1400));
    assert.equal(await page.evaluate(()=>__valley.game.state.clock.elapsed),JSON.parse(paused).clock.elapsed);
    await page.reload();await page.waitForFunction(()=>window.__valley?.world);
    assert.deepEqual(await page.evaluate(()=>__valley.game.state.flora),JSON.parse(paused).flora);
    assert.equal(await page.evaluate(()=>__valley.game.state.clock.elapsed),JSON.parse(paused).clock.elapsed);
    await page.locator('#start-button').tap();
    const winter=await page.evaluate(()=>{
      const {game,world}=__valley;
      game.mutate(s=>{s.clock.elapsed=2160;s.flora.forEach(p=>p.age=0);});
      const g=world.floraGroups.get(game.state.flora[0].id);
      return {stage:g.userData.stage,sun:world.sun.intensity};
    });
    assert.equal(winter.stage,'rest');assert.ok(winter.sun>0);
    await page.waitForFunction(()=>document.getElementById('clock-label').textContent.includes('冬'));
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    await page.screenshot({path:join(tmpdir(),`valley-winter-${name}.png`)});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'窄屏没有横向溢出');
    await page.evaluate(()=>__valley.game.mutate(s=>s.clock.elapsed=2340));
    assert.ok(await page.evaluate(()=>__valley.world.sun.intensity<=1.1),'夜间光照同步但仍可见');
    const legacy=await page.evaluate(()=>{
      const value=JSON.parse(__valley.game.exportSave());delete value.clock;delete value.flora;
      return JSON.stringify(value);
    });
    // Install the legacy fixture before the new app boots, after the old page's exit autosave.
    await context.addInitScript(({key,text})=>localStorage.setItem(key,text),{key:STORAGE_KEY,text:legacy});
    await page.reload();await page.waitForFunction(()=>window.__valley?.world);
    await page.locator('#start-button').tap();await page.evaluate(()=>__valley.openPanel('pause'));
    await page.getByText('给大人：备份与导入存档',{exact:true}).click();
    const downloaded=page.waitForEvent('download');await page.locator('[data-action="export-legacy"]').click();
    assert.equal(readFileSync(await(await downloaded).path(),'utf8'),legacy,'升级前备份可下载且原文一致');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log(`${name}: 生命周期、面板继续、暂停、存档、冬季、增量模型通过`);
    await context.close();
  }
}finally{await browser.close();}
