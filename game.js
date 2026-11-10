(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 1000, H = 600;
  const $ = id => document.getElementById(id);
  const overlay = $('intro'), startButton = $('start'), announcer = $('announcer');
  const held = new Set();
  let active = false, ended = false, last = 0, timeLeft = 99, freeze = 0, witchTime = 0;
  let audioOn = true, audioCtx = null, shake = 0, hitFlash = 0, round = 0;
  const player = makeFighter(315, 'player');
  const enemy = makeFighter(685, 'enemy');
  const particles = [];
  function makeFighter(x, team) { return {x, y:0, team, hp:100, meter:24, face:team==='player'?1:-1, attack:null, attackCd:0, dodge:0, stun:0, aiWait:1, walk:0, hurt:0}; }
  function announce(text, duration=1400) { announcer.textContent=text; announcer.classList.add('show'); window.clearTimeout(announce.timer); announce.timer=window.setTimeout(()=>announcer.classList.remove('show'),duration); }
  function tone(freq=160, duration=.08, type='sawtooth', volume=.045) {
    if (!audioOn) return;
    try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration); } catch(_) {}
  }
  function reset() {
    player.x=315;player.hp=100;player.meter=24;player.attack=null;player.attackCd=0;player.dodge=0;player.stun=0;
    enemy.x=685;enemy.hp=100;enemy.meter=24;enemy.attack=null;enemy.attackCd=0;enemy.dodge=0;enemy.stun=0;enemy.aiWait=.7;
    particles.length=0;timeLeft=99;freeze=0;witchTime=0;ended=false;active=true;last=performance.now();
    overlay.classList.add('hidden');$('hud').setAttribute('aria-hidden','false');announce('FIGHT!',900);updateHud();
  }
  startButton.addEventListener('click',reset);
  $('sound').addEventListener('click',()=>{audioOn=!audioOn;$('sound').innerHTML=`♫ <span>${audioOn?'ON':'OFF'}</span>`;if(audioOn)tone(440,.07,'sine',.02)});
  function updateHud() { $('player-health').style.width=Math.max(0,player.hp)+'%';$('enemy-health').style.width=Math.max(0,enemy.hp)+'%';$('player-meter').style.width=Math.min(100,player.meter)+'%';$('enemy-meter').style.width=Math.min(100,enemy.meter)+'%';$('clock').textContent=Math.ceil(timeLeft).toString().padStart(2,'0'); }
  function keyName(e) { if(e.code==='Space')return 'space';return e.key.toLowerCase(); }
  window.addEventListener('keydown',e=>{const k=keyName(e);if(['arrowleft','arrowright',' ','space'].includes(k))e.preventDefault();held.add(k);if((k==='r'||k==='enter')&&(!active||ended))reset();if(active&&!e.repeat)inputAction(k)});
  window.addEventListener('keyup',e=>held.delete(keyName(e)));
  document.querySelectorAll('.mobile-controls button').forEach(button=>{
    const k=button.dataset.key;const down=e=>{e.preventDefault();held.add(k.toLowerCase());if(active)inputAction(k.toLowerCase())};const up=e=>{e.preventDefault();held.delete(k.toLowerCase())};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up);
  });
  function inputAction(k) {
    if(k==='j')attack(player,'punch');if(k==='k')attack(player,'kick');if(k==='l')dodge(player);
    if(k==='space'&&player.meter>=35&&witchTime<=0){player.meter-=35;witchTime=2.1;freeze=.22;announce('WITCH TIME',1100);tone(720,.28,'sine',.06);burst(player.x+player.face*55,390,'#c7a6ff',25);}
  }
  function attack(f,type) { if(!active||f.attackCd>0||f.stun>0||f.dodge>0)return;f.attack={type,t:type==='punch'?.32:.48,hit:false};f.attackCd=type==='punch'?.37:.56;tone(type==='punch'?240:125,.07,'triangle',.022); }
  function dodge(f) { if(!active||f.dodge>0||f.stun>0)return;f.dodge=.38;f.x+=f.face*-30;f.x=Math.max(100,Math.min(900,f.x));tone(370,.1,'sine',.018);for(let i=0;i<5;i++)particles.push({x:f.x,y:410+Math.random()*40,vx:-f.face*(20+Math.random()*70),vy:-20+Math.random()*30,t:.4,color:f.team==='player'?'#d8c6ff':'#fa70af',r:2+Math.random()*3}); }
  function burst(x,y,color,n=12){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*270;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:.25+Math.random()*.55,color,r:2+Math.random()*5})}}
  function hit(attacker, target, type) {
    if(target.dodge>0)return false;
    const dist=Math.abs(attacker.x-target.x);const reach=type==='punch'?105:132;if(dist>reach)return false;
    const damage=type==='punch'?7:12;target.hp=Math.max(0,target.hp-damage);target.stun=type==='punch'?.22:.34;target.hurt=.23;attacker.meter=Math.min(100,attacker.meter+13);target.meter=Math.min(100,target.meter+6);shake=type==='kick'?9:5;hitFlash=.1;freeze=.055;
    const hx=(attacker.x+target.x)/2, hy=type==='kick'?365:390;burst(hx,hy,type==='punch'?'#fff0b0':'#ff63ae',type==='kick'?17:11);tone(type==='kick'?100:185,.12,'square',.05);return true;
  }
  function update(dt) {
    if(!active)return;
    if(freeze>0){freeze-=dt;return;}
    if(witchTime>0){witchTime-=dt;}
    timeLeft-=dt;if(timeLeft<=0){timeLeft=0;finish(player.hp>=enemy.hp?'BAYONETTA WINS':'DIO WINS');return;}
    for(const f of [player,enemy]){f.attackCd=Math.max(0,f.attackCd-dt);f.dodge=Math.max(0,f.dodge-dt);f.stun=Math.max(0,f.stun-dt);f.hurt=Math.max(0,f.hurt-dt);if(f.attack){f.attack.t-=dt;if(!f.attack.hit&&f.attack.t<(f.attack.type==='punch'?.18:.26)){f.attack.hit=true;hit(f,f===player?enemy:player,f.attack.type)}if(f.attack.t<=0)f.attack=null;}}
    if(player.stun<=0&&player.dodge<=0){let speed=250*(witchTime>0?1.18:1);if(held.has('arrowleft')||held.has('a')){player.x-=speed*dt;player.walk+=dt*12}if(held.has('arrowright')||held.has('d')){player.x+=speed*dt;player.walk+=dt*12}player.x=Math.max(100,Math.min(900,player.x));}
    player.face=player.x<enemy.x?1:-1;enemy.face=enemy.x<player.x?1:-1;
    if(enemy.stun<=0&&enemy.dodge<=0){const dx=player.x-enemy.x,dist=Math.abs(dx);enemy.aiWait-=dt;if(dist>145){enemy.x+=Math.sign(dx)*Math.min(155*dt,dist-125);enemy.walk+=dt*9;}else if(enemy.aiWait<=0){if(player.attack&&Math.random()<.22)dodge(enemy);else attack(enemy,Math.random()<.58?'punch':'kick');enemy.aiWait=.5+Math.random()*.55;}if(dist<105&&Math.random()<dt*.55&&enemy.attackCd===0)attack(enemy,'punch');enemy.x=Math.max(100,Math.min(900,enemy.x));}
    // Keep fighters from occupying the same space so both silhouettes stay readable.
    const gap=enemy.x-player.x;
    if(Math.abs(gap)<78){const push=(78-Math.abs(gap))/2;const dir=gap>=0?1:-1;player.x-=dir*push;enemy.x+=dir*push;player.x=Math.max(100,Math.min(900,player.x));enemy.x=Math.max(100,Math.min(900,enemy.x));}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=380*dt;p.t-=dt;if(p.t<=0)particles.splice(i,1)}
    shake=Math.max(0,shake-dt*28);hitFlash=Math.max(0,hitFlash-dt);updateHud();
    if(player.hp<=0)finish('DIO WINS');else if(enemy.hp<=0)finish('BAYONETTA WINS');
  }
  function finish(text){active=false;ended=true;round++;announce(text,1200);window.setTimeout(()=>{if(!ended)return;overlay.classList.remove('hidden');$('hud').setAttribute('aria-hidden','true');const title=overlay.querySelector('h1'),eyebrow=overlay.querySelector('.eyebrow'),sub=overlay.querySelector('.subtitle'),story=overlay.querySelector('.story');eyebrow.textContent='THE ECLIPSE HAS SPOKEN';title.innerHTML=text==='BAYONETTA WINS'?'BAYONETTA<br><span>VICTORIOUS</span>':'DIO<br><span>PREVAILS</span>';sub.innerHTML='ROUND COMPLETE';story.textContent=text==='BAYONETTA WINS'?'The witch has rewritten fate. The night is yours.':'The World stopped time. The rematch is yours to claim.';startButton.innerHTML='FIGHT AGAIN <span>↻</span>';},900);}

  function drawBackground(t) {
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#100e23');sky.addColorStop(.52,'#392047');sky.addColorStop(1,'#100d19');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // Moon and its fine clockwork rings
    const moon=ctx.createRadialGradient(500,210,8,500,210,148);moon.addColorStop(0,'#fff5dc');moon.addColorStop(.68,'#e3bfc9');moon.addColorStop(1,'#aa74aa00');ctx.fillStyle=moon;ctx.beginPath();ctx.arc(500,210,151,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e8cb9c44';ctx.lineWidth=1;ctx.beginPath();ctx.arc(500,210,170,0,Math.PI*2);ctx.stroke();ctx.save();ctx.translate(500,210);ctx.rotate(t*.025);ctx.setLineDash([4,8]);ctx.strokeStyle='#f8e6bf45';ctx.beginPath();ctx.arc(0,0,181,0,Math.PI*2);ctx.stroke();ctx.restore();
    for(let i=0;i<55;i++){const x=(i*173+43)%W,y=(i*83+21)%330;ctx.fillStyle=`rgba(255,235,219,${.2+((i%5)/10)})`;ctx.fillRect(x,y,1.4,1.4)}
    // Distant gothic skyline
    ctx.fillStyle='#1b1329';for(let i=0;i<12;i++){const x=i*93-20,w=65+(i%3)*15,h=90+(i*47%100);ctx.fillRect(x,350-h,w,h);ctx.beginPath();ctx.moveTo(x-8,350-h);ctx.lineTo(x+w/2,320-h);ctx.lineTo(x+w+8,350-h);ctx.fill();ctx.fillRect(x+w*.43,325-h,8,22);for(let j=0;j<3;j++){ctx.fillStyle='#dcaee622';ctx.fillRect(x+12+j*16,350-h+20,5,14);ctx.fillStyle='#1b1329'}}
    // Arena arch
    ctx.strokeStyle='#cfb47d55';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(70,460);ctx.lineTo(70,265);ctx.quadraticCurveTo(500,-50,930,265);ctx.lineTo(930,460);ctx.stroke();ctx.strokeStyle='#f4ddba25';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(84,460);ctx.lineTo(84,269);ctx.quadraticCurveTo(500,-21,916,269);ctx.lineTo(916,460);ctx.stroke();
    // Floor perspective
    const floor=ctx.createLinearGradient(0,430,0,600);floor.addColorStop(0,'#34223d');floor.addColorStop(1,'#100e19');ctx.fillStyle=floor;ctx.fillRect(0,430,W,170);ctx.strokeStyle='#d9bb8340';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,430);ctx.lineTo(W,430);for(let i=-5;i<=5;i++){ctx.moveTo(500,430);ctx.lineTo(500+i*150,600)}for(let i=1;i<6;i++){let y=430+i*i*5;ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();
    // central sigil
    ctx.save();ctx.translate(500,489);ctx.rotate(t*.06);ctx.strokeStyle='#f4d18432';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,128,26,0,0,Math.PI*2);ctx.stroke();ctx.rotate(-t*.12);ctx.beginPath();ctx.ellipse(0,0,74,16,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-44,0);ctx.lineTo(44,0);ctx.moveTo(0,-16);ctx.lineTo(0,16);ctx.stroke();ctx.restore();
  }
  function drawFighter(f,t) {
    const isP=f.team==='player', hurt=f.hurt>0, dir=f.face, bob=Math.sin(f.walk)*2.5;
    ctx.save();ctx.translate(f.x,430+bob);ctx.scale(dir,1);
    // Cast shadow
    ctx.fillStyle='#07060c88';ctx.beginPath();ctx.ellipse(0,3,50,10,0,0,Math.PI*2);ctx.fill();
    // Aura when stand rush/witch time
    if((isP&&witchTime>0)||(!isP&&Math.abs(f.x-player.x)<110&&Math.sin(t*7)>0.75)){ctx.globalAlpha=.35+Math.sin(t*10)*.12;ctx.strokeStyle=isP?'#d6aaff':'#ff69ad';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-60,47,83,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    // legs + high heels / boots
    const legColor=hurt?'#fff':isP?'#17131f':'#e5bfcc';ctx.strokeStyle=legColor;ctx.lineWidth=11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-11,-37);ctx.lineTo(-17,-8);ctx.lineTo(-28,0);ctx.moveTo(12,-37);ctx.lineTo(19,-9);ctx.lineTo(29,0);ctx.stroke();
    ctx.fillStyle=isP?'#d5a5ce':'#a62961';ctx.fillRect(-34,-3,15,4);ctx.fillRect(23,-3,15,4);
    // torso, tailored coat
    ctx.fillStyle=hurt?'#fff':isP?'#17131f':'#f3d9d3';ctx.beginPath();ctx.moveTo(-17,-89);ctx.lineTo(15,-89);ctx.lineTo(25,-42);ctx.lineTo(0,-34);ctx.lineTo(-24,-43);ctx.closePath();ctx.fill();
    // jacket trim / chest diamond
    ctx.strokeStyle=isP?'#b24a9b':'#923157';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-12,-81);ctx.lineTo(0,-57);ctx.lineTo(12,-81);ctx.moveTo(0,-57);ctx.lineTo(0,-39);ctx.stroke();
    // belt
    ctx.fillStyle='#cbb47b';ctx.fillRect(-19,-47,38,5);ctx.fillStyle='#f8e6a1';ctx.fillRect(-2,-48,5,7);
    // arms; active attack reaches out
    const swing=f.attack?(f.attack.type==='punch'?34:17):0;
    ctx.strokeStyle=hurt?'#fff':isP?'#211927':'#efcbd0';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-15,-81);ctx.lineTo(-29,-62);ctx.lineTo(-21,-47);ctx.moveTo(15,-81);ctx.lineTo(27+swing,-69);ctx.lineTo(37+swing,-64);ctx.stroke();
    // ornate gloves
    ctx.fillStyle=isP?'#d7c0eb':'#b73367';ctx.beginPath();ctx.arc(37+swing,-64,7,0,Math.PI*2);ctx.fill();
    // head and hair
    ctx.fillStyle=hurt?'#fff':isP?'#c695a8':'#f2d6c1';ctx.beginPath();ctx.ellipse(0,-101,13,16,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=isP?'#10101b':'#6d183e';ctx.beginPath();ctx.moveTo(-14,-108);ctx.quadraticCurveTo(-13,-125,2,-122);ctx.quadraticCurveTo(19,-119,14,-99);ctx.lineTo(8,-94);ctx.lineTo(6,-111);ctx.lineTo(-5,-103);ctx.closePath();ctx.fill();
    if(isP){ctx.strokeStyle='#302038';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-8,-114);ctx.quadraticCurveTo(-18,-87,-27,-79);ctx.moveTo(5,-117);ctx.quadraticCurveTo(23,-93,27,-85);ctx.stroke();}
    // glasses / head ornament
    if(isP){ctx.strokeStyle='#e5c984';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(4,-103,5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#cba75d';ctx.fillRect(-2,-120,4,5)}else{ctx.fillStyle='#e6c45f';ctx.beginPath();ctx.arc(-5,-105,2,0,Math.PI*2);ctx.arc(5,-105,2,0,Math.PI*2);ctx.fill();}
    // weapon/stand flair when attacking
    if(f.attack){ctx.strokeStyle=isP?'#efd48d':'#ff80bd';ctx.lineWidth=2;ctx.globalAlpha=.65;ctx.beginPath();ctx.arc(35+swing,-65,17,-.9,.9);ctx.stroke();ctx.globalAlpha=1}
    // summoned stand behind Bayonetta during Witch Time
    if(isP&&witchTime>0){ctx.globalAlpha=.74;ctx.translate(-34,-18);ctx.fillStyle='#b8a5ee';ctx.beginPath();ctx.ellipse(0,-86,14,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8170b8';ctx.beginPath();ctx.moveTo(-19,-69);ctx.lineTo(18,-69);ctx.lineTo(24,-28);ctx.lineTo(-22,-28);ctx.fill();ctx.strokeStyle='#c2b5ff';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-12,-62);ctx.lineTo(-29,-45);ctx.moveTo(12,-62);ctx.lineTo(26,-48);ctx.stroke();ctx.globalAlpha=1}
    ctx.restore();
  }
  function drawEffects() {for(const p of particles){ctx.globalAlpha=Math.max(0,p.t*1.7);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;if(hitFlash>0){ctx.fillStyle=`rgba(255,242,215,${hitFlash*2.2})`;ctx.fillRect(0,0,W,H)}}
  function render(now) {
    const t=now/1000;ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawBackground(t);
    // subtle vertical beam from the fractured moon
    const beam=ctx.createLinearGradient(500,185,500,440);beam.addColorStop(0,'#fff2d511');beam.addColorStop(1,'#ffb8e000');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(486,195);ctx.lineTo(514,195);ctx.lineTo(620,440);ctx.lineTo(380,440);ctx.fill();
    if(player.x<enemy.x){drawFighter(enemy,t);drawFighter(player,t)}else{drawFighter(player,t);drawFighter(enemy,t)}drawEffects();ctx.restore();
  }
  function loop(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);render(now);requestAnimationFrame(loop)}
  updateHud();requestAnimationFrame(loop);
})();
