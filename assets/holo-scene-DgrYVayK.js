import{$ as e,A as t,B as n,C as r,D as i,E as a,F as o,H as s,I as c,M as l,N as u,U as d,V as f,Y as p,Z as m,at as h,et as g,h as _,j as v,k as y,m as b,nt as x,p as S,r as C,tt as w,v as T,x as E,y as D}from"./index-DDzyQne8.js";import{i as O,n as k,r as A}from"./xing-world-C-grBLzG.js";var j={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},M=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},N=new c(-1,1,1,-1,0,1),P=new class extends _{constructor(){super(),this.setAttribute(`position`,new r([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new r([0,2,0,0,2,0],2))}},F=class{constructor(e){this._mesh=new v(P,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,N)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},I=class extends M{constructor(t,n=`tDiffuse`){super(),this.textureID=n,this.uniforms=null,this.material=null,t instanceof p?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=e.clone(t.uniforms),this.material=new p({name:t.name===void 0?`unspecified`:t.name,defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this._fsQuad=new F(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},L=class extends M{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},R=class extends M{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},z=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new g);this._width=n.width,this._height=n.height,t=new x(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:i}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new I(j),this.copyPass.material.blending=0,this.timer=new m}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}L!==void 0&&(r instanceof L?n=!0:r instanceof R&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new g);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},B=class extends M{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new T}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},V={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new T(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},H=class t extends M{constructor(t,n=1,r,a){super(),this.strength=n,this.radius=r,this.threshold=a,this.resolution=t===void 0?new g(256,256):new g(t.x,t.y),this.clearColor=new T(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let o=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new x(o,s,{type:i,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new x(o,s,{type:i,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new x(o,s,{type:i,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),o=Math.round(o/2),s=Math.round(s/2)}let c=V;this.highPassUniforms=e.clone(c.uniforms),this.highPassUniforms.luminosityThreshold.value=a,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new p({uniforms:this.highPassUniforms,vertexShader:c.vertexShader,fragmentShader:c.fragmentShader}),this.separableBlurMaterials=[];let u=[6,10,14,18,22];o=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(u[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new g(1/o,1/s),o=Math.round(o/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=n,this.compositeMaterial.uniforms.bloomRadius.value=.1;let d=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=d,this.bloomTintColors=[new w(1,1,1),new w(1,1,1),new w(1,1,1),new w(1,1,1),new w(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=e.clone(j.uniforms),this.blendMaterial=new p({uniforms:this.copyUniforms,vertexShader:j.vertexShader,fragmentShader:j.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new T,this._oldClearAlpha=1,this._basic=new l,this._fsQuad=new F(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new g(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(e,n,r,i,a){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),a&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=t.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[n]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=t.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[n]),e.clear(),this._fsQuad.render(e),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(r),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new p({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new g(.5,.5)},direction:{value:new g(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new p({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};H.BlurDirectionX=new g(1,0),H.BlurDirectionY=new g(0,1);var U={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},W=class extends M{constructor(){super(),this.isOutputPass=!0,this.uniforms=e.clone(U.uniforms),this.material=new d({name:U.name,uniforms:this.uniforms,vertexShader:U.vertexShader,fragmentShader:U.fragmentShader}),this._fsQuad=new F(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},D.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},G=3.4;function K(e,t){let n=e.map(([e,t,n,r,i,a])=>{let o=new S(r,i,a);return o.translate(e,t,n),o}),r=C(n,!1);for(let e of n)e.dispose();let i=new v(r,t);return i.castShadow=!1,i.receiveShadow=!0,i}function q(){let e=[];for(let t=0;t<7;t+=1){let n=(t+.5)/7*Math.PI*.46,r=Math.cos(n)*32,i=Math.max(8,Math.round(2*Math.PI*r/3.4));for(let r=0;r<i;r+=1){let a=(r+t%2*.5)/i*Math.PI*2;e.push({phi:n,theta:a,index:e.length})}}let n=new E(1.2,1.2,.08,6),r=new E(1.32,1.32,.05,6),i=new l({color:`#ffffff`,transparent:!0,opacity:.9,depthWrite:!1,side:2}),a=new u({color:`#1A2230`,roughness:.45,metalness:.55}),o=new y(n,i,e.length),c=new y(r,a,e.length),d=new t,f=new s,p=new w(0,1,0),m=new T;return e.forEach((e,t)=>{let n=new w(Math.cos(e.phi)*Math.cos(e.theta),Math.sin(e.phi),Math.cos(e.phi)*Math.sin(e.theta));f.setFromUnitVectors(p,n);let r=n.clone().multiplyScalar(32).add(new w(0,2,0));d.compose(r,f,new w(1,1,1)),o.setMatrixAt(t,d),d.compose(r.clone().addScaledVector(n,-.06),f,new w(1,1,1)),c.setMatrixAt(t,d),o.setColorAt(t,m.set(`#36E0E8`))}),o.instanceColor.needsUpdate=!0,{plates:o,frames:c,points:e,gap:Math.floor(e.length*.62),plateMat:i}}function J(){let e=new u({color:`#2A2E36`,roughness:.5,metalness:.55}),n=new u({color:`#243044`,roughness:.6,metalness:.4,emissive:new T(`#36E0E8`),emissiveIntensity:.15}),r=[],i=[];for(let e of h){let t=e.play?r:i;t.push([e.x,e.y+.35,e.z,7,.7,7]),t.push([e.x,e.y+.9,e.z,3.2,.35,3.2])}let a=K(r,e);a.castShadow=!0,a.receiveShadow=!0;let o=K(i,n),c=new E(.28,.45,1,8,1,!0),d=new l({color:`#FFB347`,transparent:!0,opacity:.4,depthWrite:!1}),f=new y(c,d,h.length),p=new t,m=new s;return h.forEach((e,t)=>{p.compose(new w(e.x,e.y/2,e.z),m,new w(1,Math.max(.2,e.y),1)),f.setMatrixAt(t,p)}),{nearMesh:a,farMesh:o,beams:f,beamMat:d,bodyMat:e}}function Y(){let e=new a,t=new u({color:`#3A3F48`,roughness:.42,metalness:.6}),n=new u({color:`#5AC8FF`,emissive:new T(`#5AC8FF`),emissiveIntensity:1.1,roughness:.3}),r=K([[0,2.2,0,4,2.4,12],[0,3.6,3,2.4,.8,3],[-3.2,2.3,-1,2,1.6,6],[3.2,2.3,-1,2,1.6,6]].map(([e,t,n,r,i,a])=>[e,t,n,r,i,a]),t),i=K([[-3.2,2.4,-4.2,1.2,1.1,.3],[3.2,2.4,-4.2,1.2,1.1,.3]],n);return e.add(r,i),e.position.set(0,16.5,16),{group:e,glow:n}}function X(e){let t=new Float32Array(e*3);for(let n=0;n<e;n+=1){let r=n/e*Math.PI*2*7,i=6+n%18;t[n*3]=Math.cos(r)*i,t[n*3+1]=-6-n%9*.8,t[n*3+2]=Math.sin(r)*i}let r=new _;r.setAttribute(`position`,new b(t,3));let i=new f({color:`#36E0E8`,size:.12,transparent:!0,opacity:.75,depthWrite:!1});return new n(r,i)}function Z(){let e=new a;e.name=`holo-hall`,e.visible=!1;let t=q(),n=J(),r=Y();e.add(t.frames,t.plates,n.nearMesh,n.farMesh,n.beams,r.group);let i=k();i.group.position.set(0,2,0),e.add(i.group);let s=A();s.group.position.set(1.4,2,1.2),e.add(s.group);let c=O();c.group.position.set(-1.6,2,1.4),e.add(c.group);let l=k();l.group.name=`holo-echo`,l.group.visible=!1,l.group.traverse(e=>{e.isMesh&&e.material&&(e.material=e.material.clone(),e.material.transparent=!0,e.material.opacity=.35,e.material.depthWrite=!1)}),e.add(l.group);let d=new v(new o(.42,0),new u({color:`#9ecbff`,emissive:new T(`#7eb6ff`),emissiveIntensity:.9,roughness:.35}));d.name=`holo-shard`,d.position.set(.9,2.6,.2),d.visible=!1,e.add(d);let f=null,p=!0,m=!1,g=0,_=[],y=0,b=new T,x={group:e,pads:h,plateCount:t.points.length,gapIndex:t.gap,avatar:i,starling:s,guide:c,fast:p,setQuality(t){p=t!==`fine`,x.fast=p,p&&f?(e.remove(f),f.geometry.dispose(),f.material.dispose(),f=null):!p&&!f&&(f=X(900),e.add(f))},setPlate(){return t.points.length},showEcho(e){_=Array.isArray(e)?e:[],l.group.visible=_.length>1,y=0},hideEcho(){l.group.visible=!1,_=[]},setGapFilled(e){m=!!e,d.visible=m},update(e,a,o={}){let u=p?.4:0;if(m&&(d.rotation.y=e*.6),!p||e-g>=u){g=e;let n=o.night?1.15:.85;t.points.forEach((r,i)=>{let a=.55+.3*(.5+.5*Math.sin(e*1.1+r.theta*3+r.phi*4));i===t.gap&&!m&&(a=.05),i===t.gap&&m?b.setRGB(1,.78,.35):b.setRGB(.21*a*n,.88*a*n,.91*a*n),t.plates.setColorAt(i,b)}),t.plates.instanceColor&&(t.plates.instanceColor.needsUpdate=!0)}if(n.beamMat.opacity=.32+Math.sin(e*2)*.06,r.glow.emissiveIntensity=.8+Math.sin(e*2.2)*.35,r.group.position.y=16.5+Math.sin(e*.8)*.15,i.group.position.set(o.x||0,o.y||0,o.z||0),i.group.rotation.y=o.yaw||0,i.update(e,o.mode||`idle`),s.update(e),c.update(e,o.guide||`idle`),f&&(f.rotation.y+=a*.02),l.group.visible&&_.length>1){y+=a;let t=Math.max(1,_.length-1),n=y*.6%t,r=Math.floor(n),i=n-r,o=_[r],s=_[Math.min(_.length-1,r+1)];l.group.position.set(o.x+(s.x-o.x)*i,o.y+(s.y-o.y)*i,o.z+(s.z-o.z)*i),l.update(e,`walk`)}}};return x}function Q(e,t){let n=null;for(let r of h)r.play&&Math.abs(e-r.x)<=G&&Math.abs(t-r.z)<=G&&(!n||r.y>n.y)&&(n=r);return n}function $(e,t,n){let r=h[0],i=1/0;for(let a of h){if(!a.play||a.y>n+.2)continue;let o=Math.hypot(a.x-e,a.z-t)+Math.abs(a.y-n)*.2;o<i&&(i=o,r=a)}return r}function ee(e,t,n){let r=new z(e);r.addPass(new B(t,n));let i=new H(new g(256,256),.35,.4,.86);return r.addPass(i),r.addPass(new W),{composer:r,resize(e,t){r.setSize(e,t)},render(){r.render()},dispose(){i.dispose(),r.dispose()}}}export{ee as attachBloom,Z as createHoloLayer,$ as nearestLowerPad,Q as padUnder};