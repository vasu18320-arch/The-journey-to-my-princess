(() => {
"use strict";

/* THE JOURNEY TO MY PRINCESS
   Self-contained canvas game. No external assets or libraries are required.
   Character art is deliberately drawn as crisp pixel-style vector shapes so
   GitHub Pages can run the game without broken asset paths.
*/

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const W=420,H=560, GROUND=465;
const SAVE_KEY="tjmp_anniversary_save_v1";

// ===== EASY PERSONALIZATION =====
const KNIGHT_NAME = "Knight";
const PRINCESS_NAME = "Princess";
const FINAL_MESSAGE = "OUR BEAUTIFUL LIFE TOGETHER IS ONLY BEGINNING.";
// =================================

const arcs=[
 {name:"WINTER",subtitle:"Memory I · The First Snow", collectible:"ember", color:"#ff5a28", sky:"#b7d9e8", ground:"#344c62", boss:"snowman"},
 {name:"SPRING",subtitle:"Memory II · A Sunny Morning", collectible:"leaf", color:"#51df6d", sky:"#a9dc9d", ground:"#49664b", boss:"bear"},
 {name:"RUINED SCHOOL",subtitle:"Memory III · The Calls at 12 PM", collectible:"phone", color:"#dce8ff", sky:"#171924", ground:"#282733", boss:"teacher"}
];

let save=loadSave();
let arcIndex=save.arc||0;
let mode="title";
let dialogue=null, dialogueIndex=0;
let endingStep=0;
let time=0,last=performance.now();
let keys={left:false,right:false};
let player;
let world;
let cameraX=0;

function loadSave(){
 try{return Object.assign({arc:0,completed:[],items:[[],[],[]],checkpoints:[0,0,0],complete:false},JSON.parse(localStorage.getItem(SAVE_KEY)||"{}"))}
 catch(e){return {arc:0,completed:[],items:[[],[],[]],checkpoints:[0,0,0],complete:false}}
}
function saveGame(){
 localStorage.setItem(SAVE_KEY,JSON.stringify(save));
}
function resetSave(){
 localStorage.removeItem(SAVE_KEY);
 save=loadSave(); arcIndex=0; mode="title";
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function text(t,x,y,size=14,c="#fff",align="left"){ctx.fillStyle=c;ctx.font=`700 ${size}px monospace`;ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(t,x,y)}
function line(x1,y1,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}

function newPlayer(){
 return {x:45,y:360,vx:0,vy:0,w:30,h:54,onGround:false,facing:1,hp:3,attack:0,inv:0,respawnX:45,respawnY:360,power:false};
}
function buildWorld(){
 const w={width:2700,platforms:[],items:[],mobs:[],boss:null,checkpointXs:[820,2050]};
 // base platforms
 for(let x=0;x<w.width;x+=180) w.platforms.push({x,y:GROUND+10,w:180,h:35});
 // elevated platforms
 const layouts=[
  [240,390,120],[450,340,120],[680,400,100],[880,320,130],[1090,385,130],[1320,330,140],
  [1540,390,120],[1740,325,130],[1940,390,140],[2160,340,130],[2380,390,150]
 ];
 layouts.forEach(p=>w.platforms.push({x:p[0],y:p[1],w:p[2],h:22}));
 // looping moving platforms
 w.movers=[
  {x:360,y:270,w:92,h:18,baseX:360,baseY:270,range:90,vertical:false,speed:1.0},
  {x:1180,y:250,w:90,h:18,baseX:1180,baseY:250,range:70,vertical:true,speed:1.2},
  {x:1840,y:245,w:100,h:18,baseX:1840,baseY:245,range:85,vertical:false,speed:1.1}
 ];
 w.movers.forEach(m=>w.platforms.push(m));
 // exactly ten collectibles
 for(let i=0;i<10;i++){
   const x=180+i*245+(i%2)*55;
   const y=[420,350,300,410,330][i%5];
   w.items.push({x,y,id:i,collected:save.items[arcIndex]?.includes(i),bob:i});
 }
 // patrol mobs
 const mobXs=[520,760,1020,1260,1480,1680,2010,2250,2490];
 mobXs.forEach((x,i)=>w.mobs.push({x,y:GROUND-38,w:30,h:38,dir:i%2? -1:1,min:x-80,max:x+80,speed:.45+(i%3)*.12,dead:false}));
 w.boss={x:2570,y:GROUND-150,w:120,h:150,hp:10,maxHp:10,active:false,hitFlash:0,phase:0,cool:0};
 return w;
}

function startArc(i=arcIndex){
 arcIndex=i;
 world=buildWorld();
 player=newPlayer();
 const cp=save.checkpoints[arcIndex]||0;
 player.respawnX=cp?world.checkpointXs[cp-1]+35:45;
 player.x=player.respawnX;
 player.power=(save.items[arcIndex]||[]).length>=10;
 cameraX=0;
 mode="play";
 dialogue=null;
}
function beginDialogue(lines,after){
 dialogue={lines,after};
 dialogueIndex=0;mode="dialogue";
 showDialogue();
}
function showDialogue(){
 if(!dialogue)return;
 document.getElementById("messageText").textContent=dialogue.lines[dialogueIndex];
 document.getElementById("message").classList.remove("hidden");
}
function advanceDialogue(){
 if(!dialogue)return;
 dialogueIndex++;
 if(dialogueIndex>=dialogue.lines.length){
   document.getElementById("message").classList.add("hidden");
   const cb=dialogue.after;dialogue=null;
   if(cb)cb();
   else mode="play";
 } else showDialogue();
}

document.getElementById("continueBtn").addEventListener("click",advanceDialogue);

function setControl(id,key){
 const b=document.getElementById(id);
 const on=()=>{keys[key]=true;b.classList.add("pressed")};
 const off=()=>{keys[key]=false;b.classList.remove("pressed")};
 ["pointerdown","touchstart"].forEach(e=>b.addEventListener(e,on,{passive:true}));
 ["pointerup","pointercancel","pointerleave","touchend"].forEach(e=>b.addEventListener(e,off,{passive:true}));
}
setControl("leftBtn","left");setControl("rightBtn","right");
function actionButton(id,fn){
 const b=document.getElementById(id);
 ["pointerdown","touchstart"].forEach(e=>b.addEventListener(e,(ev)=>{ev.preventDefault();fn();},{passive:false}));
}
actionButton("jumpBtn",()=>jump());
actionButton("attackBtn",()=>attack());

window.addEventListener("keydown",e=>{
 if(["ArrowLeft","ArrowRight","ArrowUp"," ","a","d","w","j","x","Escape","Enter"].includes(e.key))e.preventDefault();
 if(mode==="dialogue" && (e.key==="Enter"||e.key===" ")){advanceDialogue();return}
 if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=true;
 if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=true;
 if(e.key==="ArrowUp"||e.key.toLowerCase()==="w"||e.key===" ")jump();
 if(e.key.toLowerCase()==="j"||e.key.toLowerCase()==="x")attack();
 if(e.key==="Escape") toggleFullscreen();
});
window.addEventListener("keyup",e=>{
 if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=false;
 if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=false;
});

function jump(){if(mode!=="play"||!player)return;if(player.onGround){player.vy=-10.5;player.onGround=false}}
function attack(){
 if(mode!=="play"||!player)return;
 if(player.attack<=0)player.attack=.24;
}

function toggleFullscreen(){
 const el=document.documentElement;
 if(!document.fullscreenElement) el.requestFullscreen?.().catch(()=>{});
 else document.exitFullscreen?.();
}

function hurt(){
 if(player.inv>0)return;
 player.hp--;player.inv=1.1;
 if(player.hp<=0){
   player.hp=3;player.x=player.respawnX;player.y=player.respawnY;player.vx=0;player.vy=0;
 }
}

function update(dt){
 time+=dt;
 if(mode!=="play")return;
 const speed=2.65;
 player.vx=(keys.right?speed:0)-(keys.left?speed:0);
 if(player.vx!==0)player.facing=Math.sign(player.vx);
 player.vy+=.45;
 player.x+=player.vx;
 player.y+=player.vy;
 player.onGround=false;
 // platforms
 const prevBottom=player.y+player.h-player.vy;
 for(const p of world.platforms){
   if(player.x+player.w>p.x && player.x<p.x+p.w &&
      player.y+player.h>=p.y && prevBottom<=p.y+5 && player.vy>=0){
      player.y=p.y-player.h;player.vy=0;player.onGround=true;
   }
 }
 // falling
 if(player.y>H+150){player.hp=3;player.x=player.respawnX;player.y=player.respawnY;player.vy=0}
 // movers
 world.movers.forEach(m=>{
   const phase=time*m.speed;
   if(m.vertical)m.y=m.baseY+Math.sin(phase)*m.range;
   else m.x=m.baseX+Math.sin(phase)*m.range;
 });
 // item pickup
 world.items.forEach(it=>{
   if(!it.collected && Math.hypot(player.x+15-it.x,player.y+25-it.y)<30){
     it.collected=true;
     save.items[arcIndex]=save.items[arcIndex]||[];
     if(!save.items[arcIndex].includes(it.id))save.items[arcIndex].push(it.id);
     saveGame();
     if(save.items[arcIndex].length===10){
       player.power=true;
       saveGame();
       beginDialogue([`All 10 ${arcIndex===0?"ember":arcIndex===1?"green":"call"} memories are gathered.`,`A new power awakens within the knight.`],()=>{mode="play"});
     }
   }
 });
 // checkpoints
 world.checkpointXs.forEach((x,i)=>{
   if(player.x>x && (save.checkpoints[arcIndex]||0)<i+1){
     save.checkpoints[arcIndex]=i+1;player.respawnX=x+35;player.respawnY=GROUND-55;saveGame();
   }
 });
 // mobs
 for(const m of world.mobs){
   if(m.dead)continue;
   m.x+=m.dir*m.speed;
   if(m.x<m.min||m.x>m.max)m.dir*=-1;
   if(overlap(player,m) && player.attack<=0)hurt();
   if(player.attack>0 && overlap({x:player.x+player.facing*22,y:player.y+8,w:32,h:35},m))m.dead=true;
 }
 // attack timer
 if(player.attack>0)player.attack=Math.max(0,player.attack-dt);
 if(player.inv>0)player.inv=Math.max(0,player.inv-dt);
 // boss
 const b=world.boss;
 if(save.items[arcIndex]?.length>=10)b.active=true;
 if(b.active){
   b.cool-=dt;b.hitFlash=Math.max(0,b.hitFlash-dt);
   if(player.x>2450 && b.cool<=0){b.phase=(b.phase+1)%3;b.cool=1.4}
   if(overlap(player,b) && player.attack<=0)hurt();
   if(player.attack>0 && overlap({x:player.x+player.facing*20,y:player.y+5,w:42,h:45},b)){
     b.hp--;b.hitFlash=.12;player.attack=0;
     if(b.hp<=0){b.hp=0;bossDefeated()}
   }
 }
 cameraX=clamp(player.x-150,0,world.width-W);
}

function overlap(a,b){return a.x<a.x+a.w && a.x+a.w>b.x && a.y<a.y+a.h && a.y+a.h>b.y}

function bossDefeated(){
 mode="dialogue";
 if(arcIndex===0){
   beginDialogue(["SNOWMAN: ...the princess...","SNOWMAN: She was taken away...","SNOWMAN: Find her beyond the spring."],()=>nextArc());
 }else if(arcIndex===1){
   beginDialogue(["BEAR: Human... princess... not here!","BEAR: Hmm... somewhere beyond... school...","BEAR: Grraa—good luck!"],()=>nextArc());
 }else{
   beginDialogue(["TEACHER: The princess...","TEACHER: ...rightfully belongs to you..."],()=>startEnding());
 }
}
function nextArc(){
 if(arcIndex<2){
   save.completed[arcIndex]=true;save.arc=arcIndex+1;saveGame();
   arcIndex++;
   startArc(arcIndex);
 }else startEnding();
}

function startEnding(){mode="ending";endingStep=0;time=0}
function updateEnding(dt){
 time+=dt;
 if(mode==="ending" && time>1.2 && endingStep===0)endingStep=1;
 if(mode==="ending" && time>3.0 && endingStep===1)endingStep=2;
 if(mode==="ending" && time>4.8 && endingStep===2)endingStep=3;
 if(mode==="ending" && time>6.6 && endingStep===3)endingStep=4;
 if(mode==="ending" && time>9.0 && endingStep===4){endingStep=5;save.complete=true;save.arc=2;saveGame()}
}

function drawBackground(){
 const a=arcs[arcIndex];
 ctx.fillStyle=a.sky;ctx.fillRect(0,0,W,H);
 if(arcIndex===0)drawWinter();
 else if(arcIndex===1)drawSpring();
 else drawSchool();
}

function drawWinter(){
 rect(0,0,W,GROUND,"#b7d9e8");
 for(let i=0;i<14;i++){const x=(i*83-cameraX*.12)%460;rect(x,70+(i%4)*32,55,9,"#d9edf4")}
 // moon/sun
 ctx.fillStyle="#ffe9a5";ctx.beginPath();ctx.arc(350,88,44,0,Math.PI*2);ctx.fill();
 for(let i=0;i<7;i++){
   let x=((i*190-cameraX*.2)%520)-40;
   rect(x,290,130,110,"#61758a");rect(x+18,265,94,25,"#52667a");
   rect(x+35,330,20,48,"#f3db82");rect(x+78,330,20,48,"#f3db82");
 }
 for(let i=0;i<16;i++){let x=((i*77-cameraX*.35)%500)-40;drawPine(x,340+(i%3)*8)}
 for(let i=0;i<35;i++){let x=(i*97+time*10)%440;let y=(i*61)%430;ctx.fillStyle="#fff";ctx.fillRect(x,y,3,3)}
}
function drawPine(x,y){line(x,y-55,x,y+30,"#4d4a4a",4);for(let j=0;j<3;j++){line(x,y-45+j*18,x-20-j*5,y-15+j*18,"#4d4a4a",4);line(x,y-45+j*18,x+20+j*5,y-15+j*18,"#4d4a4a",4)}}
function drawSpring(){
 rect(0,0,W,GROUND,"#9ed694");ctx.fillStyle="#fff3ad";ctx.beginPath();ctx.arc(340,82,45,0,Math.PI*2);ctx.fill();
 for(let i=0;i<7;i++){let x=((i*190-cameraX*.15)%520)-50;rect(x,292,130,105,"#d7a96d");rect(x+12,267,105,28,"#f1d28d");rect(x+30,330,22,45,"#7aa86e");rect(x+78,330,22,45,"#7aa86e")}
 for(let i=0;i<9;i++){let x=((i*105-cameraX*.25)%500)-30;drawTree(x,345)}
 rect(0,GROUND,W,95,"#52754c");
 for(let i=0;i<30;i++){let x=(i*71-cameraX*.4)%440,y=440+(i%4)*5;rect(x,y,4,4,i%2?"#f4c5d6":"#fff1a4")}
}
function drawTree(x,y){line(x,y-55,x,y+25,"#684c36",7);ctx.fillStyle="#4d9d58";ctx.beginPath();ctx.arc(x,y-60,25,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x-17,y-40,20,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+18,y-40,20,0,Math.PI*2);ctx.fill()}
function drawSchool(){
 rect(0,0,W,GROUND,"#171923");
 for(let i=0;i<9;i++){let x=((i*150-cameraX*.18)%520)-60;rect(x,120,115,240,"#292936");rect(x+15,155,35,50,"#080a11");rect(x+65,155,35,50,"#080a11");rect(x+20,225,75,8,"#464653")}
 for(let i=0;i<14;i++){let x=(i*71+time*12)%450,y=80+(i*47)%350;ctx.fillStyle="rgba(180,190,220,.18)";ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill()}
 rect(0,GROUND,W,95,"#24232e");
}

function drawPlatform(p){
 rect(p.x-cameraX,p.y,p.w,p.h,arcIndex===2?"#3d3a47":"#415a6e");
 rect(p.x-cameraX,p.y,p.w,4,arcIndex===1?"#79a36d":"#b6c8c9");
}
function drawCollectible(it){
 if(it.collected)return;
 const x=it.x-cameraX,y=it.y+Math.sin(time*4+it.bob)*5;
 ctx.save();ctx.shadowBlur=18;ctx.shadowColor=arcs[arcIndex].color;
 ctx.fillStyle=arcs[arcIndex].color;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
 ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.globalAlpha=.8;ctx.fillRect(x-2,y-6,4,4);
 if(arcIndex===2){ctx.fillStyle="#111";ctx.fillRect(x-6,y-3,12,8);ctx.fillStyle="#fff";ctx.fillRect(x-3,y-1,6,4)}
 ctx.restore();
}

function drawMob(m){
 if(m.dead)return;
 const x=m.x-cameraX,y=m.y;
 if(arcIndex===0)drawSmallSnowman(x,y);
 else if(arcIndex===1)drawSmallBear(x,y);
 else drawShadow(x,y);
}
function drawSmallSnowman(x,y){ctx.fillStyle="#f3f3f1";ctx.beginPath();ctx.arc(x+15,y+25,15,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+15,y+9,11,0,Math.PI*2);ctx.fill();rect(x+9,y+5,3,3,"#171923");rect(x+18,y+5,3,3,"#171923");rect(x+15,y+10,3,3,"#e26c38")}
function drawSmallBear(x,y){ctx.fillStyle="#76513b";ctx.beginPath();ctx.arc(x+15,y+21,15,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+15,y+8,11,0,Math.PI*2);ctx.fill();ctx.fillStyle="#231a18";ctx.fillRect(x+10,y+6,3,3);ctx.fillRect(x+18,y+6,3,3)}
function drawShadow(x,y){rect(x+5,y+8,20,30,"#050509");ctx.fillStyle="#e7e9ff";ctx.fillRect(x+10,y+13,4,3);ctx.fillRect(x+17,y+13,4,3)}

function drawBoss(){
 const b=world.boss;if(!b.active)return;
 const x=b.x-cameraX,y=b.y;
 if(arcIndex===0)drawBossSnowman(x,y,b);
 else if(arcIndex===1)drawBossBear(x,y,b);
 else drawBossTeacher(x,y,b);
 // hp
 rect(245,82,150,9,"#17151b");rect(245,82,150*(b.hp/b.maxHp),9,"#ef5d63");
 text("BOSS",240,77,9,"#fff","right");
}
function drawBossSnowman(x,y,b){
 ctx.save();if(b.hitFlash>0)ctx.globalAlpha=.65;
 ctx.fillStyle="#f2f2ef";ctx.beginPath();ctx.arc(x+60,y+105,45,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+60,y+58,34,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+60,y+25,25,0,Math.PI*2);ctx.fill();
 rect(x+48,y+18,8,8,"#16161b");rect(x+66,y+18,8,8,"#16161b");rect(x+59,y+29,8,6,"#df6336");
 rect(x+27,y-3,66,14,"#4b2632");rect(x+42,y-18,35,16,"#4b2632");
 line(x+30,y+65,x-5,y+45,"#563b32",6);line(x+90,y+65,x+125,y+45,"#563b32",6);ctx.restore();
}
function drawBossBear(x,y,b){
 ctx.save();if(b.hitFlash>0)ctx.globalAlpha=.65;
 ctx.fillStyle="#6b4938";ctx.beginPath();ctx.ellipse(x+60,y+93,48,57,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+60,y+38,39,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#8a624b";ctx.beginPath();ctx.arc(x+43,y+4,13,0,Math.PI*2);ctx.arc(x+77,y+4,13,0,Math.PI*2);ctx.fill();
 rect(x+44,y+30,6,6,"#170f0e");rect(x+71,y+30,6,6,"#170f0e");rect(x+55,y+42,11,7,"#1d1310");
 line(x+20,y+72,x-8,y+54,"#6b4938",18);line(x+100,y+72,x+128,y+54,"#6b4938",18);ctx.restore();
}
function drawBossTeacher(x,y,b){
 ctx.save();if(b.hitFlash>0)ctx.globalAlpha=.65;
 ctx.fillStyle="#77725f";ctx.beginPath();ctx.arc(x+60,y+35,35,0,Math.PI*2);ctx.fill();rect(x+25,y+65,70,70,"#6a6658");rect(x+34,y+125,20,30,"#24242a");rect(x+67,y+125,20,30,"#24242a");
 rect(x+38,y+23,22,11,"#17151b");rect(x+64,y+23,22,11,"#17151b");line(x+60,y+23,x+60,y+34,"#17151b",3);
 rect(x+51,y+38,6,6,"#d45b65");rect(x+69,y+38,6,6,"#d45b65");
 line(x+35,y+80,x+8,y+62,"#77725f",13);line(x+86,y+80,x+113,y+62,"#77725f",13);
 ctx.restore();
}

function drawKnight(){
 const p=player,x=p.x-cameraX,y=p.y;
 if(p.inv>0 && Math.floor(time*15)%2===0)return;
 ctx.save();ctx.translate(x+15,y+27);ctx.scale(p.facing,1);
 // cape
 ctx.fillStyle="#8f2632";ctx.beginPath();ctx.moveTo(-12,-10);ctx.lineTo(-32,17);ctx.lineTo(-25,28);ctx.lineTo(-7,14);ctx.closePath();ctx.fill();
 // legs
 rect(-11,17,9,20,"#4f5660");rect(3,17,9,20,"#4f5660");rect(-13,34,13,7,"#2b3037");rect(2,34,14,7,"#2b3037");
 // torso armor
 rect(-13,-13,27,34,"#7b8490");rect(-9,-10,19,28,"#aab1ba");rect(-5,-5,11,5,"#4a5059");
 // shoulder plates
 ctx.fillStyle="#929aa5";ctx.beginPath();ctx.arc(-14,-8,7,0,Math.PI*2);ctx.arc(14,-8,7,0,Math.PI*2);ctx.fill();
 // helmet
 ctx.fillStyle="#9ea7b2";ctx.beginPath();ctx.arc(0,-28,17,Math.PI,0);ctx.fill();rect(-17,-28,34,15,"#717985");rect(-14,-19,28,7,"#252b33");
 // visor
 for(let i=-10;i<=8;i+=6)rect(i,-20,3,6,"#11161c");
 // plume
 ctx.fillStyle="#2456a6";ctx.beginPath();ctx.moveTo(-2,-42);ctx.quadraticCurveTo(14,-53,20,-40);ctx.quadraticCurveTo(9,-37,1,-34);ctx.closePath();ctx.fill();
 // sword
 if(p.attack>0){line(15,-5,48,-27,"#e9f4ff",7);line(15,-5,48,-27,"#6e7d8b",2)}
 else {line(13,-5,32,-25,"#e9f4ff",6);line(13,-5,32,-25,"#6e7d8b",2)}
 line(10,-7,18,1,"#d5b06a",3);
 if(p.power){ctx.shadowBlur=18;ctx.shadowColor=arcIndex===2?"#dce8ff":arcs[arcIndex].color;ctx.strokeStyle=arcIndex===2?"#eaf2ff":arcs[arcIndex].color;ctx.lineWidth=2;ctx.strokeRect(-20,-45,40,86);ctx.shadowBlur=0}
 ctx.restore();
}

function drawHUD(){
 rect(8,8,404,60,"rgba(5,5,9,.84)");
 text("VITALITY",18,22,9,"#a7a3a9");
 for(let i=0;i<3;i++)text(i<player.hp?"♥":"♡",70+i*20,22,18,i<player.hp?"#f07b94":"#777");
 const n=save.items[arcIndex]?.length||0;
 text(arcs[arcIndex].collectible.toUpperCase(),145,22,9,"#aaa");
 text(`${n}/10`,190,22,14,arcs[arcIndex].color);
 text("CHECKPOINT",235,22,9,"#aaa");
 text(`${save.checkpoints[arcIndex]||0}/2`,315,22,14,"#e7d9b2");
 text(arcs[arcIndex].subtitle,210,48,9,"#ddd","center");
 text("⛶",392,22,15,"#eee","center");
}
function drawTitle(){
 ctx.fillStyle="#08080d";ctx.fillRect(0,0,W,H);
 for(let i=0;i<35;i++){ctx.fillStyle=i%3?"#262636":"#4b3d55";ctx.fillRect((i*71)%W,(i*47)%H,2,2)}
 text("THE JOURNEY",W/2,105,25,"#e9d7a4","center");
 text("TO MY PRINCESS",W/2,138,24,"#e9d7a4","center");
 text("AN ANNIVERSARY QUEST",W/2,177,11,"#aaa","center");
 drawKnightTitle(105,295);drawPrincess(300,295,1);
 buttonCanvas(95,385,230,48,"START NEW JOURNEY");
 buttonCanvas(95,445,230,48,save.arc>0||save.complete?"CONTINUE":"CONTINUE");
 text("⛶  DOUBLE-TAP = FULLSCREEN",W/2,488,8,"#777","center");
 text("A / D  MOVE    W / SPACE  JUMP    J / X  ACT",W/2,515,8,"#777","center");
}
function buttonCanvas(x,y,w,h,label){
 rect(x+3,y+3,w,h,"#000");rect(x,y,w,h,"#17171f");ctx.strokeStyle="#777";ctx.strokeRect(x+.5,y+.5,w-1,h-1);text(label,x+w/2,y+h/2,12,"#eee","center");
}
function drawKnightTitle(x,y){ctx.save();ctx.translate(x,y);ctx.scale(1.15,1.15);drawKnight();ctx.restore()}
function drawPrincess(x,y,scale=1){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ctx.fillStyle="#d98b9e";ctx.beginPath();ctx.moveTo(0,20);ctx.lineTo(-52,100);ctx.lineTo(55,100);ctx.closePath();ctx.fill();
 ctx.fillStyle="#fff0f4";ctx.beginPath();ctx.moveTo(0,30);ctx.lineTo(-22,98);ctx.lineTo(22,98);ctx.closePath();ctx.fill();
 ctx.fillStyle="#f1c2a8";ctx.beginPath();ctx.arc(0,-5,24,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#542d38";ctx.beginPath();ctx.arc(0,-14,26,Math.PI,0);ctx.fill();ctx.fillRect(-23,-15,46,14);
 ctx.fillStyle="#e9c34f";ctx.beginPath();ctx.moveTo(-12,-36);ctx.lineTo(-5,-45);ctx.lineTo(0,-36);ctx.lineTo(7,-45);ctx.lineTo(14,-36);ctx.closePath();ctx.fill();
 ctx.fillStyle="#4a2732";ctx.fillRect(-10,-5,3,3);ctx.fillRect(7,-5,3,3);ctx.restore();
}

function drawEnding(){
 ctx.fillStyle="#15101c";ctx.fillRect(0,0,W,H);
 // warm floor and glow
 ctx.fillStyle="rgba(255,205,140,.12)";ctx.beginPath();ctx.arc(210,270,160,0,Math.PI*2);ctx.fill();
 rect(0,430,W,130,"#251a25");
 const kx=105, py=340;
 // princess walks from right toward knight
 let px=endingStep>=1?285:390;
 if(endingStep>=2)px=250;
 drawKnightEnding(kx,py,endingStep>=3);
 drawPrincess(px,py,1.05);
 if(endingStep>=3){
   line(125,360,210,360,"#d9b8a0",5);
   line(220,360,250,360,"#d9b8a0",5);
 }
 if(endingStep>=4){
   ctx.fillStyle="#ff6d91";ctx.shadowBlur=18;ctx.shadowColor="#ff6d91";
   ctx.beginPath();ctx.moveTo(210,180);ctx.bezierCurveTo(190,155,155,178,210,220);ctx.bezierCurveTo(265,178,230,155,210,180);ctx.fill();ctx.shadowBlur=0;
   text("Happy anniversary, Princess...",W/2,255,14,"#f5e7d4","center");
   text("I missed you so much.",W/2,282,14,"#f5e7d4","center");
 }
 if(endingStep>=5){
   rect(32,385,356,92,"rgba(5,5,9,.82)");text(FINAL_MESSAGE.split(" IS ")[0]||FINAL_MESSAGE,W/2,412,11,"#e7d7ae","center");
   if(FINAL_MESSAGE.includes(" IS ")) text("IS "+FINAL_MESSAGE.split(" IS ").slice(1).join(" IS "),W/2,438,15,"#fff","center");text("♥",W/2,462,16,"#ff7895","center");
 }
}
function drawKnightEnding(x,y,kneel){
 ctx.save();ctx.translate(x,y);ctx.scale(1.2,1.2);
 // simple larger matching knight
 ctx.fillStyle="#8f2632";ctx.beginPath();ctx.moveTo(-12,-5);ctx.lineTo(-38,45);ctx.lineTo(-12,40);ctx.closePath();ctx.fill();
 ctx.fillStyle="#8f98a3";ctx.fillRect(-13,-20,27,50);ctx.fillStyle="#aeb6bf";ctx.fillRect(-9,-16,19,25);
 ctx.fillStyle="#9da7b2";ctx.beginPath();ctx.arc(0,-34,18,Math.PI,0);ctx.fill();ctx.fillRect(-18,-34,36,14);ctx.fillStyle="#20252c";ctx.fillRect(-13,-25,26,6);
 ctx.fillStyle="#2456a6";ctx.beginPath();ctx.moveTo(0,-52);ctx.quadraticCurveTo(20,-63,23,-50);ctx.lineTo(5,-45);ctx.closePath();ctx.fill();
 ctx.fillStyle="#555e68";ctx.fillRect(-10,28,9,17);ctx.fillRect(3,28,9,17);
 if(kneel){ctx.rotate(-.1);ctx.fillRect(-10,41,22,6);line(10,10,45,35,"#edf5ff",5)}
 else {ctx.fillRect(-14,45,15,6);ctx.fillRect(2,45,16,6)}
 ctx.restore();
}

function render(){
 ctx.clearRect(0,0,W,H);
 if(mode==="title"){drawTitle();return}
 if(mode==="ending"){drawEnding();return}
 drawBackground();
 for(const p of world.platforms)drawPlatform(p);
 world.items.forEach(drawCollectible);
 world.mobs.forEach(drawMob);
 drawBoss();
 drawKnight();
 drawHUD();
 if(world.boss.active && player.x>2380 && (save.items[arcIndex]?.length||0)>=10){
   text("BOSS ARENA",W/2,108,10,"#fff","center");
 }
}

function clickCanvas(e){
 if(mode!=="title")return;
 const r=canvas.getBoundingClientRect();
 const x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
 if(x>365&&y<40){toggleFullscreen();return}
 if(x>80&&x<340&&y>370&&y<440){
   save={arc:0,completed:[],items:[[],[],[]],checkpoints:[0,0,0],complete:false};saveGame();startArc(0);
 } else if(x>80&&x<340&&y>435&&y<505){
   startArc(save.complete?0:(save.arc||0));
 }
}
canvas.addEventListener("pointerdown",clickCanvas);

function loop(now){
 const dt=Math.min(.033,(now-last)/1000);last=now;
 update(dt);updateEnding(dt);render();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// A small fullscreen affordance: double tap game canvas.
let tapT=0;
canvas.addEventListener("pointerup",()=>{
 const now=Date.now();if(now-tapT<350)toggleFullscreen();tapT=now;
});

// When a boss is defeated, advance after the dialogue if needed.
const originalAdvance=advanceDialogue;
window.advanceDialogue=originalAdvance;
})();
