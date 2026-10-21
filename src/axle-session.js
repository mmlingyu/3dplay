const SIDES = ['left', 'right'];

const failure = (message) => ({ ok: false, message });
const success = (message) => ({ ok: true, message });

export class AxleSession {
  constructor() {
    this.disposed = false;
    this.axle = { id: 'axle', angle: 0 };
    this.wheels = {
      left: { id: 'wheel-left', attached: false, angle: 0 },
      right: { id: 'wheel-right', attached: false, angle: 0 },
    };
  }

  attach(side, partId = `wheel-${side}`) {
    if (this.disposed) return failure('试装台已经关闭。');
    if (!SIDES.includes(side)) return failure('这个位置没有轮轴插槽。');
    const wheel = this.wheels[side];
    if (partId !== wheel.id) return failure('这个轮子和插槽对不上。');
    if (wheel.attached) return failure('这个轮子已经装好啦。');
    wheel.attached = true;
    return success(`${side === 'left' ? '左' : '右'}轮装到转轴上了。`);
  }

  detach(side) {
    if (this.disposed) return failure('试装台已经关闭。');
    if (!SIDES.includes(side)) return failure('这里没有可以取下的轮子。');
    const wheel = this.wheels[side];
    if (!wheel.attached) return failure('这个位置还没有装轮子。');
    wheel.attached = false;
    return success(`${side === 'left' ? '左' : '右'}轮取下来啦。`);
  }

  attachBlade(partId = 'windmill-blade') {
    if (this.disposed) return failure('试装台已经关闭。');
    if (this.blade?.attached) return failure('叶片已经装好啦。');
    this.blade = { id: partId, attached: true, angle: 0 };
    return success('叶片装到轮轴上了。');
  }

  driveAxle(radians) {
    if (this.disposed) return failure('试装台已经关闭。');
    if (!this.blade?.attached) return failure('先把叶片接到轮轴上。');
    if (!Number.isFinite(radians) || Math.abs(radians) > Math.PI * 2) {
      return failure('这次转动幅度太大了，再轻轻转一下。');
    }
    this.axle.angle += radians;
    this.blade.angle += radians;
    return success('轮轴和叶片一起转了。');
  }

  turn(side, radians) {
    if (this.disposed) return failure('试装台已经关闭。');
    if (!SIDES.includes(side)) return failure('先选一个轮子。');
    if (!Number.isFinite(radians) || Math.abs(radians) > Math.PI * 2) {
      return failure('这次转动幅度太大了，再轻轻转一下。');
    }
    const wheel = this.wheels[side];
    if (!wheel.attached) return failure('先把轮子装到转轴上。');
    wheel.angle += radians;
    return success(`${side === 'left' ? '左' : '右'}轮转动了。`);
  }

  snapshot() {
    const connections = SIDES.filter((side) => this.wheels[side].attached).map((side) => ({
      id: `joint-${side}`,
      kind: 'revolute',
      partId: this.wheels[side].id,
      portId: `socket-${side}`,
      parentId: this.axle.id,
    }));
    const snap = {
      axle: { ...this.axle },
      wheels: {
        left: { ...this.wheels.left },
        right: { ...this.wheels.right },
      },
      connections,
      disposed: this.disposed,
    };
    if (this.blade) {
      snap.blades = [{ ...this.blade }];
      if (this.blade.attached) {
        snap.connections = [...connections, {
          id: 'joint-blade',
          kind: 'revolute',
          partId: this.blade.id,
          portId: 'socket-axle',
          parentId: this.axle.id,
        }];
      }
    }
    return snap;
  }

  dispose() {
    this.disposed = true;
  }
}
