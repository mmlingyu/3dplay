import test from 'node:test';
import assert from 'node:assert/strict';
import * as life from '../src/life-data.js';

test('现实样式时钟按24小时游戏日驱动12小时指针',()=>{
  assert.equal(typeof life.clockHands,'function');
  assert.deepEqual(life.clockHands(0),{hour:6,minute:0,hourAngle:180,minuteAngle:0});
  assert.equal(life.clockHands(1).minuteAngle,36);
  assert.equal(life.clockHands(1).hourAngle,183);
  assert.equal(life.clockHands(30).hour,9);
  assert.equal(life.clockHands(180).hour,0);
  assert.equal(life.clockHands(240).hourAngle,180);
});

test('时段标签跟着钟面：早上、中午、下午、晚上、深夜',()=>{
  for(const [elapsed,hour,period] of [
    [0,6,'早上'],[119,17,'下午'],[120,18,'晚上'],
    [140,20,'晚上'],[180,0,'深夜'],[239,5,'早上'],[240,6,'早上'],
  ]){
    assert.equal(life.clockHands(elapsed).hour,hour);
    assert.equal(life.clockInfo({elapsed}).period,period);
  }
});
