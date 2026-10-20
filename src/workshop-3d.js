import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ITEMS, RECIPES } from './game-data.js';
import { WorkshopSession } from './workshop-session.js';
import { WORKSHOP_RULES as RULES, madeLine, needLine, unit, whereToGet } from './workshop-data.js';

export class Workshop3D {
  constructor(root,game,{large=false,notify=()=>{}}={}){
    this.root=root;this.canvas=root.querySelector('#workshop-canvas');this.game=game;this.notify=notify;
    this.session=new WorkshopSession(game,{large});this.disposed=false;this.drag=null;this.activeMaterial='wood';this.lastProduct=null;
    this.abort=new AbortController();this.pickables=[];this.targets=new Map();this.labels=[];this.geometries=[];this.materials=[];
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.tablePlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.55);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8eddd');
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,RULES.pixelRatio));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.camera=new THREE.OrthographicCamera();this.camera.position.set(...RULES.camera.position);this.camera.lookAt(...RULES.camera.lookAt);
    this.scene.add(new THREE.HemisphereLight('#fff9e4','#8a9972',2.4));
    const sun=new THREE.DirectionalLight('#fff4da',2.4);sun.position.set(-4,9,6);this.scene.add(sun);
    this.box=this.geometry(new RoundedBoxGeometry(1,1,1,2,.045));
    this.ball=this.geometry(new THREE.SphereGeometry(1,16,12));
    this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,12));
    this.mats={};for(const [id,color] of Object.entries(RULES.colors))this.mats[id]=this.material(color);
    this.hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
    this.materials.push(this.hitMaterial);
    for(const [id,item] of Object.entries(ITEMS))this.mats[`item-${id}`]=this.material(item.color);
    this.buildBench();this.dynamic=new THREE.Group();this.scene.add(this.dynamic);
    this.ghost=new THREE.Group();this.ghost.visible=false;this.scene.add(this.ghost);
    this.bind();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas);
    this.unsubscribe=game.subscribe(()=>{if(!this.disposed){const inventory=JSON.stringify(game.state.inventory);if(inventory!==this.inventoryKey)this.refresh();}});
    this.refresh();this.resize();this.ready=true;
    this.renderer.setAnimationLoop(()=>{
      if(this.disposed||document.hidden)return;
      this.renderer.render(this.scene,this.camera);this.positionLabels();
    });
  }
  geometry(g){this.geometries.push(g);return g;}
  material(color){const m=new THREE.MeshStandardMaterial({color,roughness:.9});this.materials.push(m);return m;}
  boxAt(parent,mat,position,scale){
    const m=new THREE.Mesh(this.box,typeof mat==='string'?this.mats[mat]:mat);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;
  }
  buildBench(){
    const g=new THREE.Group();this.scene.add(g);
    this.boxAt(g,'top',[0,.94,.25],[6.8,.28,4.6]);
    for(const x of [-2.8,2.8])for(const z of [-1.4,1.9])this.boxAt(g,'wood',[x,.35,z],[.25,.9,.25]);
    for(let x=-3;x<=3;x+=.6)this.boxAt(g,'rim',[x,1.085,.25],[.014,.01,4.45]);
    this.boxAt(g,'rim',[0,1.05,2.1],[4.5,.12,.85]);
    this.boxAt(g,'slot',[0,1.13,2.1],[4.3,.1,.65]);
    this.boxAt(g,'rim',[2.55,1.05,-.35],[1.45,.13,2.75]);
    this.boxAt(g,'slot',[2.55,1.13,-.35],[1.27,.08,2.6]);
    this.boxAt(g,'wood',[2.45,1.27,1.8],[.72,.4,.65]);
    this.lever=new THREE.Group();this.lever.position.set(2.45,1.5,1.8);g.add(this.lever);
    this.boxAt(this.lever,'wood',[0,.42,0],[.13,.9,.13]);
    this.knob=this.boxAt(this.lever,'lever',[0,.92,0],[.55,.28,.32]);
    this.leverTarget=new THREE.Group();this.leverTarget.position.copy(this.knob.position);this.lever.add(this.leverTarget);
    this.markTarget(this.leverTarget,{kind:'lever',key:'lever'});
  }
  itemModel(item,parent,position,scale=1){
    const g=new THREE.Group();g.position.set(...position);g.scale.setScalar(scale);parent.add(g);
    const mat=this.mats[`item-${item}`];
    if(item==='ball'){const m=new THREE.Mesh(this.ball,mat);m.scale.setScalar(.32);m.position.y=.3;g.add(m);}
    else if(item==='workbench'){
      this.boxAt(g,mat,[0,.48,0],[.75,.13,.6]);
      for(const x of [-.25,.25])for(const z of [-.2,.2])this.boxAt(g,mat,[x,.23,z],[.1,.46,.1]);
    }else if(item==='chest'){
      this.boxAt(g,mat,[0,.25,0],[.64,.5,.55]);this.boxAt(g,'rim',[0,.4,0],[.68,.05,.6]);
      this.boxAt(g,'cream',[0,.31,.29],[.11,.14,.03]);
    }else if(item==='stick'){
      this.boxAt(g,mat,[0,.1,0],[.11,.15,.76]);
    }else if(item==='post'){
      this.boxAt(g,mat,[0,.3,0],[.6,.17,.12]);
      for(const x of [-.23,.23])this.boxAt(g,mat,[x,.17,0],[.08,.34,.1]);
    }    else if(item==='ramp'||item==='roof'){
      const points=[-.35,0,.3,.35,0,.3,.35,.48,-.3,-.35,0,.3,.35,.48,-.3,-.35,.48,-.3];
      this.rampGeometry??=this.geometry(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)));
      this.rampGeometry.computeVertexNormals();const m=new THREE.Mesh(this.rampGeometry,mat);g.add(m);
    }else if(item==='window'){
      this.boxAt(g,mat,[0,.32,0],[.62,.64,.08]);this.boxAt(g,'cream',[0,.32,.05],[.46,.46,.03]);
    }else if(item==='door'){
      this.boxAt(g,mat,[0,.4,0],[.5,.8,.08]);this.boxAt(g,'cream',[.14,.38,.05],[.06,.06,.03]);
    }else if(item==='bed'){
      this.boxAt(g,mat,[0,.18,0],[.78,.1,.52]);this.boxAt(g,'cream',[-.18,.26,0],[.28,.12,.4]);
      for(const x of[-.3,.3])for(const z of[-.18,.18])this.boxAt(g,mat,[x,.08,z],[.07,.16,.07]);
    }else if(item==='fence'){
      for(const x of[-.28,0,.28])this.boxAt(g,mat,[x,.28,0],[.08,.56,.08]);
      this.boxAt(g,mat,[0,.34,0],[.64,.08,.06]);this.boxAt(g,mat,[0,.18,0],[.64,.08,.06]);
    }else if(item==='pot'){
      const m=new THREE.Mesh(this.cylinder,mat);m.scale.set(.22,.28,.22);m.position.y=.2;g.add(m);
      this.boxAt(g,'cream',[0,.4,0],[.16,.18,.16]);
    }else if(item==='wreath'){
      this.boxAt(g,mat,[0,.34,0],[.5,.5,.08]);this.boxAt(g,'cream',[0,.34,.05],[.22,.22,.04]);
    }else if(item==='lantern'){
      this.boxAt(g,mat,[0,.34,0],[.28,.4,.28]);this.boxAt(g,'cream',[0,.34,0],[.18,.22,.18]);
    }else if(item==='flag'){
      this.boxAt(g,mat,[0,.4,0],[.06,.8,.06]);this.boxAt(g,'lever',[.22,.58,0],[.38,.22,.04]);
    }else{
      const wood=item==='wood';
      this.boxAt(g,mat,[0,wood?.28:.12,0],wood?[.62,.56,.58]:[.68,.22,.72]);
      for(const x of [-.16,.14])this.boxAt(g,'rim',[x,wood?.565:.235,0],[.025,.012,wood?.5:.6]);
    }
    return g;
  }
  markTarget(group,target){
    if(target.kind!=='slot'&&!group.userData.hitArea){
      const area=new THREE.Mesh(this.box,this.hitMaterial);area.scale.set(...RULES.touchTarget);
      area.position.y=target.kind==='lever'?0:.25;
      group.add(area);group.userData.hitArea=area;
    }
    group.userData.workshopTarget=target;this.targets.set(`${target.kind}:${target.key}`,group);
    group.traverse(m=>{if(m.isMesh)this.pickables.push(m);});
  }
  label(parent,text,point){
    const el=document.createElement('span');el.className='workshop-world-label';el.textContent=text;this.root.querySelector('.workshop-labels').append(el);
    this.labels.push({el,parent,point:new THREE.Vector3(...point)});
  }
  refresh(){
    if(this.disposed)return;
    this.cancelDrag();
    this.inventoryKey=JSON.stringify(this.game.state.inventory);
    this.dynamic.clear();for(const label of this.labels)label.el.remove();this.labels=[];
    this.targets.clear();this.pickables=[];this.markTarget(this.leverTarget,{kind:'lever',key:'lever'});
    const session=this.session,s=RULES.slotSpacing;
    this.slots=[];
    for(let y=0;y<session.side;y++)for(let x=0;x<session.side;x++){
      const px=(x-(session.side-1)/2)*s-.55,pz=(y-(session.side-1)/2)*s-.35;
      const g=new THREE.Group();g.position.set(px,1.08,pz);this.dynamic.add(g);
      this.boxAt(g,'rim',[0,.02,0],[.98,.06,.98]);
      const pad=this.boxAt(g,'slot',[0,.065,0],[.87,.04,.87]);this.slots.push(pad);
      if(session.grid[y][x])this.itemModel(session.grid[y][x],g,[0,.13,0],.9);
      this.markTarget(g,{kind:'slot',key:`${x},${y}`,x,y});
    }
    for(const [i,item] of ['wood','plank','stick','stone','clay','branch'].entries()){
      const g=new THREE.Group();g.position.set(-2.4+i*.95,1.23,2.1);this.dynamic.add(g);
      const count=this.game.state.inventory[item];this.itemModel(item,g,[0,0,0],.72);
      this.markTarget(g,{kind:'material',key:item,item,disabled:count<=0});
      this.label(g,`${ITEMS[item].name} ×${count}`,[0,.68,0]);
    }
    const snapshot=session.snapshot(),matches=RECIPES.filter(r=>snapshot.matches.includes(r.id));
    matches.forEach((r,i)=>{
      const g=this.itemModel(r.output.item,this.dynamic,[2.55,1.19,-1.15+i*1.5],.92);
      if(r.id===snapshot.selectedRecipe)this.boxAt(g,'valid',[0,-.04,0],[.94,.06,.95]);
      this.markTarget(g,{kind:'result',key:r.id,recipe:r.id});this.label(g,`${r.name} ×${r.output.count}${r.id===snapshot.selectedRecipe?' ✓':''}`,[0,.83,0]);
    });
    if(!matches.length&&this.lastProduct){
      const g=this.itemModel(this.lastProduct.item,this.dynamic,[2.55,1.19,-.45]);
      this.label(g,`做好了：${ITEMS[this.lastProduct.item].name} ×${this.lastProduct.count}`,[0,.85,0]);
    }
    this.knob.material=snapshot.ready?this.mats.valid:this.mats.lever;
    this.label(this.lever,'拉下制作',[0,1.25,0]);
    const chosen=RECIPES.find(r=>r.id===snapshot.selectedRecipe);
    const bill=chosen?needLine(chosen,this.game.state.inventory):null;
    const flow=bill?`${bill.needs.map(n=>`${n.count} ${unit(n.item)}${n.name}`).join('＋')} → ${chosen.output.count} ${unit(chosen.output.item)}${ITEMS[chosen.output.item].name}`:'';
    this.root.querySelector('#workshop-status').textContent=snapshot.missing.length?`${flow?`${flow}。`:''}${snapshot.missing.map(i=>`${ITEMS[i].name}不够，${whereToGet(i)}`).join('；')}。`:
      chosen&&snapshot.ready?`${flow}。够做了，把木拉杆向下拉，或点上面的「制作」。`:
      this.lastProduct?madeLine({ output: { item: this.lastProduct.item, count: this.lastProduct.count } }, this.lastProduct.count):
      matches.length>1&&!snapshot.selectedRecipe?'这个摆法能做出不止一个。点右边的物品，选一个。':
      '点想做的东西，再点「制作」。做好的会放进背包。';
    for(const el of this.root.querySelectorAll('[data-recipe-row]'))el.classList.toggle('is-shown',el.dataset.recipeRow===snapshot.selectedRecipe);
    this.root.querySelector('[data-action="workshop-pull"]').disabled=!snapshot.ready;
    this.root.dispatchEvent(new CustomEvent('workshop-math'));
    this.positionLabels();
  }
  resize(){
    const {clientWidth:w,clientHeight:h}=this.canvas;if(!w||!h)return;
    this.renderer.setSize(w,h,false);
    const narrow=w<RULES.camera.narrowBreakpoint;
    this.camera.position.set(...(narrow?RULES.camera.narrowPosition:RULES.camera.position));
    this.camera.lookAt(...RULES.camera.lookAt);
    const aspect=w/h;
    const half=(narrow?RULES.camera.narrowWidth:Math.max(RULES.camera.width,RULES.camera.minHeight*aspect))/2;
    this.camera.left=-half;this.camera.right=half;this.camera.top=half/aspect;this.camera.bottom=-half/aspect;
    this.camera.near=.1;this.camera.far=40;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);this.positionLabels();
  }
  pointFor(kind,key=kind){
    const g=this.targets.get(`${kind}:${key}`);if(!g)return null;
    this.scene.updateMatrixWorld(true);const p=g.getWorldPosition(new THREE.Vector3());
    if(kind!=='lever')p.y+=kind==='slot'?.13:.22;
    p.project(this.camera);const r=this.canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  }
  positionLabels(){
    this.scene.updateMatrixWorld(true);const r=this.canvas.getBoundingClientRect();
    for(const {el,parent,point} of this.labels){
      const p=parent.localToWorld(point.clone()).project(this.camera);
      el.style.left=`${(p.x+1)*r.width/2}px`;el.style.top=`${(1-p.y)*r.height/2}px`;
    }
  }
  hit(x,y){
    const r=this.canvas.getBoundingClientRect();this.pointer.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);
    this.ray.setFromCamera(this.pointer,this.camera);
    this.scene.updateMatrixWorld(true);
    for(const hit of this.ray.intersectObjects(this.pickables,false)){
      let g=hit.object;while(g){if(g.userData.workshopTarget)return g.userData.workshopTarget;g=g.parent;}
    }
    return null;
  }
  cancelDrag(){
    const id=this.drag?.id;
    this.drag=null;
    if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
    if(this.ghost){this.ghost.visible=false;this.ghost.clear();}
    if(this.lever)this.lever.rotation.x=0;
    for(const slot of this.slots||[])slot.material=this.mats.slot;
  }
  craft(){
    const result=this.session.craft();
    if(result.ok){
      this.lastProduct={item:result.item,count:result.count};
      result.message=madeLine(result.recipe,result.count);
    }
    this.refresh();this.notify(result);
    return result;
  }
  example(id){this.cancelDrag();const ok=this.session.example(id);if(ok){this.lastProduct=null;this.refresh();}return ok;}
  resizeSlots(side){if(this.session.resize(side)){this.lastProduct=null;this.refresh();return true;}return false;}
  bind(){
    const signal=this.abort.signal;
    const pointers=new Set();
    let multi=false;
    // A second finger anywhere cancels the pending operation, including on UI.
    document.addEventListener('pointerdown',e=>{
      pointers.add(e.pointerId);
      if(pointers.size>1){multi=true;this.cancelDrag();}
    },{signal,capture:true});
    for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{
      pointers.delete(e.pointerId);if(!pointers.size)multi=false;
    },{signal});
    this.canvas.addEventListener('pointerdown',e=>{
      if(multi)return;
      if(this.drag&&this.drag.id!==e.pointerId){this.cancelDrag();return;}
      if(e.button!==0)return;
      const target=this.hit(e.clientX,e.clientY);if(!target||target.disabled)return;
      e.preventDefault();this.canvas.setPointerCapture(e.pointerId);
      this.drag={id:e.pointerId,target,x:e.clientX,y:e.clientY,moved:false,pull:0};
    },{signal});
    this.canvas.addEventListener('pointermove',e=>{
      const d=this.drag;if(!d||d.id!==e.pointerId)return;
      if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<RULES.dragThreshold)return;
      d.moved=true;
      if(d.target.kind==='lever'){
        d.pull=Math.max(0,Math.min(1,(e.clientY-d.y)/RULES.leverTravel));this.lever.rotation.x=d.pull*1.1;return;
      }
      const item=d.target.item||(d.target.kind==='slot'&&this.session.grid[d.target.y][d.target.x]);if(!item)return;
      if(!this.ghost.visible){this.itemModel(item,this.ghost,[0,0,0],.85);this.ghost.visible=true;}
      this.hit(e.clientX,e.clientY);const p=this.ray.ray.intersectPlane(this.tablePlane,new THREE.Vector3());if(p)this.ghost.position.copy(p);
      const target=this.hit(e.clientX,e.clientY);
      for(const slot of this.slots)slot.material=this.mats.slot;
      if(target?.kind==='slot')this.slots[target.y*this.session.side+target.x].material=this.mats.valid;
    },{signal});
    this.canvas.addEventListener('pointerup',e=>{
      const d=this.drag;if(!d||d.id!==e.pointerId)return;
      const inside=document.elementFromPoint(e.clientX,e.clientY)===this.canvas;
      const target=inside?this.hit(e.clientX,e.clientY):null;
      this.cancelDrag();if(!inside)return;
      if(d.target.kind==='lever'){if(d.moved&&d.pull>=RULES.leverCommit)this.craft();return;}
      if(d.moved&&target?.kind==='slot'){
        if(d.target.kind==='material')this.session.put(target.x,target.y,d.target.item);
        else if(d.target.kind==='slot')this.session.move(d.target.x,d.target.y,target.x,target.y);
        this.refresh();
      }else if(!d.moved){
        if(target?.kind==='result'){this.session.choose(target.recipe);this.refresh();}
        if(target?.kind==='material'){this.activeMaterial=target.item;this.root.querySelector('#workshop-status').textContent=`拿起${ITEMS[target.item].name}，再点空槽`;}
        if(target?.kind==='slot'){this.session.put(target.x,target.y,this.session.grid[target.y][target.x]?null:this.activeMaterial);this.refresh();}
      }
    },{signal});
    this.canvas.addEventListener('pointercancel',()=>this.cancelDrag(),{signal});
    this.canvas.addEventListener('lostpointercapture',()=>this.cancelDrag(),{signal});
    const reset=()=>{pointers.clear();multi=false;this.cancelDrag();};
    window.addEventListener('blur',reset,{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();},{signal});
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.ready=false;this.cancelDrag();this.session.dispose();this.abort.abort();this.unsubscribe?.();
    this.resizeObserver.disconnect();this.renderer.setAnimationLoop(null);
    for(const label of this.labels)label.el.remove();
    for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();
    this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();
  }
}
