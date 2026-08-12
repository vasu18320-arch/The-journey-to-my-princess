(() => {
"use strict";

/* ============================================================
   THE JOURNEY TO MY PRINCESS
   Self-contained portrait pixel-art canvas game.
   Major character references are loaded from the repository root.
   ============================================================ */

const CONFIG = {
  finalMessage: "Our beautiful life together is only beginning.",
  title: "THE JOURNEY TO MY PRINCESS",
  logicalW: 360,
  logicalH: 540,
  controlsH: 154,
  gravity: 900,
  moveSpeed: 155,
  jumpSpeed: 355,
  maxFall: 560,
  attackTime: 0.24,
  invulnTime: 0.85,
  collectiblesPerArc: 10,
  requiredAura: 5,
  references: {
    knight: "knight.png",
    princess: "princess.png",
    bear: "bear.png",
    teacher: "teacher.png"
  }
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const toast = document.getElementById("toast");
const buttons = {
  left: document.getElementById("leftBtn"),
  right: document.getElementById("rightBtn"),
  jump: document.getElementById("jumpBtn"),
  act: document.getElementById("actBtn")
};

const img = {};
const refs = {};
let assetsReady = false;

function loadImage(key, src) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => { img[key] = im; resolve(); };
    im.onerror = () => resolve();
    im.src = src;
  });
}

async function loadAssets() {
  await Promise.all([
    loadImage("knight", CONFIG.references.knight),
    loadImage("princess", CONFIG.references.princess),
    loadImage("bear", CONFIG.references.bear),
    loadImage("teacher", CONFIG.references.teacher)
  ]);
  assetsReady = true;
}

function fitReference(im, maxW, maxH) {
  if (!im || !im.naturalWidth) return null;
  const s = Math.min(maxW / im.naturalWidth, maxH / im.naturalHeight);
  return { w: im.naturalWidth * s, h: im.naturalHeight * s };
}

/* Draws supplied images while making the near-white reference background
   transparent. This lets the user upload the original PNGs unchanged. */
function drawTransparent(im, x, y, w, h, flip=false, alpha=1) {
  if (!im || !im.naturalWidth) return false;
  const oc = drawTransparent.cache || (drawTransparent.cache = new Map());
  const key = im.src + "|" + Math.round(w) + "|" + Math.round(h);
  let off = oc.get(key);
  if (!off) {
    off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    const o = off.getContext("2d");
    o.imageSmoothingEnabled = false;
    o.drawImage(im,0,0,off.width,off.height);
    const d = o.getImageData(0,0,off.width,off.height);
    for(let i=0;i<d.data.length;i+=4){
      const r=d.data[i], g=d.data[i+1], b=d.data[i+2];
      if(r>238 && g>238 && b>238) d.data[i+3]=0;
    }
    o.putImageData(d,0,0);
    oc.set(key,off);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + (flip ? w : 0), y);
  if(flip) ctx.scale(-1,1);
  ctx.drawImage(off,0,0,w,h);
  ctx.restore();
  return true;
}

const arcs = [
  {
    id:0, name:"WINTER", memory:"Memory I · The First Snow",
    bg:"#b8d2dc", ground:"#263b4a", accent:"#f3df9b",
    boss:"bear", bossName:"THE WINTER BEAR",
    story:"The first snow remembers every step that led you here."
  },
  {
    id:1, name:"SPRING", memory:"Memory II · Where We Bloomed",
    bg:"#9dc4a6", ground:"#314b3b", accent:"#ffdca3",
    boss:"shadow", bossName:"THE SHADOW OF DISTANCE",
    story:"Spring returns — carrying the memories you refuse to lose."
  },
  {
    id:2, name:"RUINED SCHOOL", memory:"Memory III · The Long Way Home",
    bg:"#6e6d78", ground:"#25262d", accent:"#f4c7d4",
    boss:"teacher", bossName:"THE TEACHER MONSTER",
    story:"Even the hardest memory cannot keep you from her."
  }
];

let state = "title";
let arcIndex = 0;
let checkpoint = 0;
let aura = 0;
let completed = false;
let levelTime = 0;
let endingTime = 0;
let flash = 0;
let shake = 0;
let noticeTimer = 0;

const keys = {left:false,right:false,jump:false,act:false};
const just = {jump:false,act:false};

const player = {
  x:55,y:420,w:44,h:62,vx:0,vy:0,onGround:false,facing:1,
  attack:0,health:3,invuln:0
};

let platforms = [];
let collectibles = [];
let enemies = [];
let boss = null;
let story = "";

function saveGame() {
  localStorage.setItem("tjmp-save", JSON.stringify({
    arcIndex, checkpoint, aura, completed
  }));
}
function readSave() {
  try { return JSON.parse(localStorage.getItem("tjmp-save") || "null"); }
  catch(e){ return null; }
}
function clearSave(){ localStorage.removeItem("tjmp-save"); }

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(()=>toast.classList.remove("show"), 1500);
}

function newGame() {
  arcIndex=0; checkpoint=0; aura=0; completed=false;
  enterArc(0);
  state="play";
  saveGame();
}
function continueGame() {
  const s=readSave();
  if(!s){ showToast("NO SAVED JOURNEY"); return; }
  arcIndex=s.arcIndex||0; checkpoint=s.checkpoint||0; aura=s.aura||0; completed=!!s.completed;
  if(completed){ state="title"; showToast("JOURNEY COMPLETE"); return; }
  enterArc(arcIndex);
  state="play";
}
function resetGame() {
  clearSave(); newGame();
}

function makePlatform(x,y,w,h=16){ return {x,y,w,h}; }

function enterArc(i) {
  arcIndex=i;
  levelTime=0;
  story=arcs[i].story;
  player.x=checkpoint===0?42:185;
  player.y=405;
  player.vx=0; player.vy=0; player.health=3; player.invuln=0; player.attack=0;
  buildLevel(i);
}

function buildLevel(i) {
  const groundY=468;
  platforms=[
    makePlatform(0,groundY,360,72),
    makePlatform(30,405,80,12),
    makePlatform(132,365,70,12),
    makePlatform(232,320,82,12),
    makePlatform(300,405,54,12)
  ];
  if(i===1){
    platforms=[
      makePlatform(0,groundY,360,72),
      makePlatform(20,410,72,12),
      makePlatform(110,350,75,12),
      makePlatform(205,392,65,12),
      makePlatform(275,330,70,12)
    ];
  }
  if(i===2){
    platforms=[
      makePlatform(0,groundY,360,72),
      makePlatform(22,405,70,12),
      makePlatform(112,345,65,12),
      makePlatform(205,390,72,12),
      makePlatform(285,305,58,12)
    ];
  }

  collectibles=[];
  const xs=[48,83,145,171,240,270,310,335,115,220];
  const ys=[370,430,330,290,285,435,370,275,320,360];
  for(let n=0;n<10;n++){
    collectibles.push({x:xs[n],y:ys[n],r:7,collected:false,phase:n*0.7});
  }

  enemies=[];
  if(i===0){
    enemies.push({type:"snow",x:250,y:442,w:25,h:25,vx:-30,dir:-1,hp:1});
  } else if(i===1){
    enemies.push({type:"shadow",x:150,y:438,w:28,h:30,vx:35,dir:1,hp:2});
    enemies.push({type:"shadow",x:285,y:438,w:28,h:30,vx:-25,dir:-1,hp:2});
  } else {
    enemies.push({type:"shadow",x:90,y:438,w:28,h:30,vx:28,dir:1,hp:2});
    enemies.push({type:"shadow",x:245,y:438,w:28,h:30,vx:-35,dir:-1,hp:2});
  }

  boss={
    x:290,y:groundY-72,w:62,h:72,
    hp:5,maxHp:5,active:false,defeated:false,vx:0,attack:0,hit:0,dir:-1
  };
}

function rectsOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function damagePlayer() {
  if(player.invuln>0 || state!=="play") return;
  player.health--;
  player.invuln=CONFIG.invulnTime;
  flash=.2; shake=7;
  player.vy=-170;
  player.vx=-player.facing*80;
  if(player.health<=0){
    showToast("BACK TO CHECKPOINT");
    checkpoint=Math.max(0,checkpoint);
    enterArc(arcIndex);
    saveGame();
  }
}

function attackBoss() {
  if(!boss || !boss.active || boss.defeated || player.attack>0) return;
  player.attack=CONFIG.attackTime;
  const hitbox={x:player.facing>0?player.x+28:player.x-34,y:player.y+14,w:40,h:30};
  if(rectsOverlap(hitbox,boss)){
    boss.hp--;
    boss.hit=.18;
    boss.x += player.facing*9;
    shake=4;
    if(boss.hp<=0){
      boss.defeated=true;
      showToast("BOSS DEFEATED");
      setTimeout(()=>{ if(state==="play") state="stageclear"; },500);
    }
  }
}

function update(dt) {
  if(noticeTimer>0) noticeTimer-=dt;
  flash=Math.max(0,flash-dt);
  shake=Math.max(0,shake-dt*20);

  if(state==="play") updatePlay(dt);
  if(state==="ending") updateEnding(dt);
}

function updatePlay(dt) {
  levelTime+=dt;
  player.invuln=Math.max(0,player.invuln-dt);
  player.attack=Math.max(0,player.attack-dt);

  let move=0;
  if(keys.left) move-=1;
  if(keys.right) move+=1;
  player.vx += (move*CONFIG.moveSpeed-player.vx)*Math.min(1,dt*10);
  if(move!==0) player.facing=move;

  if(just.jump && player.onGround){
    player.vy=-CONFIG.jumpSpeed;
    player.onGround=false;
  }
  if(just.act) attackBoss();

  player.vy=Math.min(CONFIG.maxFall,player.vy+CONFIG.gravity*dt);
  const oldY=player.y;
  player.x += player.vx*dt;
  player.y += player.vy*dt;
  player.x=Math.max(4,Math.min(360-player.w-4,player.x));

  player.onGround=false;
  for(const p of platforms){
    if(player.x+player.w>p.x && player.x<p.x+p.w &&
       oldY+player.h<=p.y+3 && player.y+player.h>=p.y && player.vy>=0){
      player.y=p.y-player.h;
      player.vy=0;
      player.onGround=true;
    }
  }
  if(player.y>560){ damagePlayer(); return; }

  for(const c of collectibles){
    if(!c.collected){
      const dx=(player.x+player.w/2)-c.x, dy=(player.y+player.h/2)-c.y;
      if(dx*dx+dy*dy<24*24){
        c.collected=true;
        aura++;
        saveGame();
        showToast("+1 EMBER AURA");
      }
    }
  }

  for(const e of enemies){
    e.x += e.vx*dt;
    if(e.x<20 || e.x>335){ e.vx*=-1; }
    if(rectsOverlap(player,e)) damagePlayer();
  }

  const collectedHere=collectibles.filter(c=>c.collected).length;
  boss.active = collectedHere>=CONFIG.requiredAura;
  if(boss.active && !boss.defeated){
    const target=player.x+player.w/2;
    const bx=boss.x+boss.w/2;
    boss.dir=target<bx?-1:1;
    if(Math.abs(target-bx)>45) boss.x += boss.dir*24*dt;
    boss.attack=Math.max(0,boss.attack-dt);
    boss.hit=Math.max(0,boss.hit-dt);
    if(Math.abs(target-bx)<48 && boss.attack<=0){
      boss.attack=1.1;
      damagePlayer();
    }
  }

  if(player.x>338 && boss.defeated) {
    state="stageclear";
  }
}

function updateEnding(dt) {
  endingTime+=dt;
  if(endingTime<2.7){
    player.x += 30*dt;
    player.facing=1;
  } else if(endingTime<4.2){
    // Princess and knight settle together.
  }
}

function startEnding() {
  state="ending"; endingTime=0;
  player.x=65; player.y=420; player.vx=0; player.vy=0;
}

function advanceArc() {
  if(arcIndex<2){
    arcIndex++;
    checkpoint=0;
    aura=0;
    enterArc(arcIndex);
    state="play";
    saveGame();
  } else {
    completed=true;
    saveGame();
    startEnding();
  }
}

function handleCanvasTap(x,y) {
  if(state==="title"){
    if(y>270 && y<325) newGame();
    else if(y>330 && y<385) continueGame();
    else if(y>390 && y<445){
      const s=readSave();
      if(s && confirm("Reset your saved journey?")) resetGame();
      else if(!s) newGame();
    } else if(y>450 && y<500) toggleFullscreen();
    return;
  }
  if(state==="stageclear"){
    if(y>410 && y<480) advanceArc();
    return;
  }
  if(state==="ending" && endingTime>5.0){
    state="title";
    return;
  }
}

function draw() {
  ctx.clearRect(0,0,360,540);
  if(state==="title") drawTitle();
  else if(state==="play") drawGame();
  else if(state==="stageclear") { drawGame(); drawStageClear(); }
  else if(state==="ending") drawEnding();

  if(flash>0){
    ctx.fillStyle=`rgba(255,255,255,${Math.min(.35,flash*1.5)})`;
    ctx.fillRect(0,0,360,540);
  }
}

function skyGradient(top,bottom){
  const g=ctx.createLinearGradient(0,0,0,540);
  g.addColorStop(0,top); g.addColorStop(1,bottom); return g;
}

function drawTitle(){
  ctx.fillStyle="#080b12"; ctx.fillRect(0,0,360,540);
  ctx.fillStyle="#101726"; ctx.fillRect(12,12,336,516);
  ctx.strokeStyle="#4b5362"; ctx.strokeRect(18,18,324,504);

  ctx.fillStyle="#f5d67d"; ctx.font="bold 18px monospace";
  ctx.textAlign="center"; ctx.fillText("THE JOURNEY",180,85);
  ctx.fillStyle="#e7e1cc"; ctx.font="11px monospace";
  ctx.fillText("TO MY PRINCESS",180,105);

  ctx.fillStyle="#b9c7d5"; ctx.font="10px monospace";
  ctx.fillText("A SMALL ADVENTURE FOR A BIG LOVE",180,140);

  // decorative knight silhouette
  drawKnight(158,158,44,66,1,.9);

  menuButton(65,270,230,48,"START",true);
  menuButton(65,330,230,48,"CONTINUE",!!readSave());
  menuButton(65,390,230,48,"RESET / NEW GAME",!!readSave());
  menuButton(65,450,230,40,"FULL SCREEN",true);

  ctx.fillStyle="#777e8a"; ctx.font="8px monospace";
  ctx.fillText("PORTRAIT EDITION · SAVES IN YOUR BROWSER",180,515);
  ctx.textAlign="left";
}

function menuButton(x,y,w,h,label,enabled){
  ctx.fillStyle=enabled?"#111721":"#0b0e14";
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=enabled?"#596274":"#2c313b";
  ctx.strokeRect(x,y,w,h);
  ctx.fillStyle=enabled?"#f1dfad":"#575d67";
  ctx.font="bold 11px monospace"; ctx.textAlign="center";
  ctx.fillText(label,x+w/2,y+h/2+4);
  ctx.textAlign="left";
}

function drawGame(){
  const a=arcs[arcIndex];
  ctx.fillStyle=skyGradient(a.bg, "#d9d5c8");
  ctx.fillRect(0,0,360,540);
  drawBackground(a);
  drawPlatforms(a);

  for(const c of collectibles) if(!c.collected) drawCollectible(c);
  for(const e of enemies) drawEnemy(e);
  drawBoss(a);

  // Player
  if(player.invuln<=0 || Math.floor(levelTime*14)%2===0){
    drawKnight(player.x,player.y,player.w,player.h,player.facing,1);
  }
  if(player.attack>0) drawSword(player);

  drawHUD(a);
  if(!boss.active) drawBossLock();
}

function drawBackground(a){
  if(arcIndex===0){
    ctx.fillStyle="rgba(49,70,92,.7)";
    for(let i=0;i<7;i++){
      const x=i*62-15, h=75+(i%3)*35;
      ctx.beginPath();ctx.moveTo(x,260);ctx.lineTo(x+35,260-h);ctx.lineTo(x+75,260);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle="#647586"; ctx.fillRect(28,260,85,85);
    ctx.fillStyle="#d9c98b"; ctx.fillRect(42,302,18,43);ctx.fillRect(84,302,18,43);
    // snow
    ctx.fillStyle="rgba(255,255,255,.72)";
    for(let i=0;i<55;i++){
      const x=(i*67)%360, y=(i*47+levelTime*8)%455;
      ctx.fillRect(x,y,2,2);
    }
  } else if(arcIndex===1){
    ctx.fillStyle="rgba(52,87,62,.45)";
    for(let i=0;i<8;i++){
      const x=i*50+10;
      ctx.fillRect(x,245,7,125);
      ctx.beginPath();ctx.arc(x+4,235,28,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#e6c4cf";
    for(let i=0;i<18;i++){ctx.fillRect((i*37)%350,190+(i%4)*22,3,3);}
  } else {
    ctx.fillStyle="rgba(25,27,35,.6)";
    for(let i=0;i<5;i++){
      ctx.fillRect(i*78+12,205,55,180);
      ctx.fillStyle="#11131a";ctx.fillRect(i*78+20,225,39,65);ctx.fillRect(i*78+20,305,39,65);
      ctx.fillStyle="rgba(25,27,35,.6)";
    }
    ctx.strokeStyle="rgba(220,210,205,.35)";
    ctx.lineWidth=2;
    for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*48,215);ctx.lineTo(i*48+25,380);ctx.stroke();}
  }
}

function drawPlatforms(a){
  for(const p of platforms){
    ctx.fillStyle="#18202a";ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.fillStyle=a.accent;ctx.fillRect(p.x,p.y,p.w,3);
    ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(p.x+3,p.y+5,p.w-6,2);
  }
}

function drawCollectible(c){
  const yy=c.y+Math.sin(levelTime*3+c.phase)*3;
  ctx.save();
  ctx.translate(c.x,yy);
  ctx.globalAlpha=.28;
  ctx.fillStyle="#ffd56e";ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;ctx.fillStyle="#ffe8a2";
  ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,0);ctx.lineTo(0,7);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();
  ctx.restore();
}

function drawEnemy(e){
  if(e.type==="snow"){
    ctx.fillStyle="#f3f4f2";ctx.beginPath();ctx.arc(e.x+13,e.y+17,13,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#242832";ctx.fillRect(e.x+8,e.y+14,3,3);ctx.fillRect(e.x+16,e.y+14,3,3);
    ctx.fillStyle="#e9a56d";ctx.fillRect(e.x+13,e.y+18,5,3);
  } else {
    ctx.fillStyle="rgba(26,24,37,.9)";ctx.fillRect(e.x,e.y,e.w,e.h);
    ctx.fillStyle="#c98aa4";ctx.fillRect(e.x+7,e.y+9,5,5);ctx.fillRect(e.x+17,e.y+9,5,5);
  }
}

function drawBoss(a){
  if(!boss || boss.defeated) return;
  if(!boss.active) return;
  if(a.boss==="bear") drawBear(boss.x,boss.y,boss.w,boss.h,boss.dir,boss.hit?0.75:1);
  else if(a.boss==="teacher") drawTeacher(boss.x,boss.y,boss.w,boss.h,boss.dir,boss.hit?0.75:1);
  else drawShadowBoss(boss.x,boss.y,boss.w,boss.h,boss.dir,boss.hit?0.75:1);

  ctx.fillStyle="#0a0c11";ctx.fillRect(boss.x-2,boss.y-11,boss.w+4,6);
  ctx.fillStyle="#db6b7e";ctx.fillRect(boss.x,boss.y-10,(boss.w)*(boss.hp/boss.maxHp),4);
}

function drawBossLock(){
  ctx.fillStyle="rgba(8,11,17,.88)";ctx.fillRect(72,180,216,42);
  ctx.strokeStyle="#555c6c";ctx.strokeRect(72,180,216,42);
  ctx.fillStyle="#e7e0cf";ctx.font="10px monospace";
  ctx.fillText("BOSS LOCKED · "+Math.min(CONFIG.requiredAura,collectibles.filter(c=>c.collected).length)+"/"+CONFIG.requiredAura+" AURAS",88,205);
}

function drawHUD(a){
  ctx.fillStyle="rgba(8,11,17,.84)";
  ctx.fillRect(10,12,116,42);ctx.fillRect(132,12,72,42);ctx.fillRect(210,12,91,42);ctx.fillRect(306,12,44,42);
  ctx.strokeStyle="#525b69";
  ctx.strokeRect(10,12,116,42);ctx.strokeRect(132,12,72,42);ctx.strokeRect(210,12,91,42);ctx.strokeRect(306,12,44,42);

  ctx.fillStyle="#9da4ae";ctx.font="8px monospace";ctx.fillText("VITALITY",18,29);
  for(let i=0;i<3;i++){
    ctx.fillStyle=i<player.health?"#ee88a1":"#323743";
    ctx.font="18px serif";ctx.fillText("♥",58+i*20,44);
  }

  ctx.fillStyle="#9da4ae";ctx.font="8px monospace";ctx.fillText("AURAS",140,29);
  ctx.fillStyle="#f3d77d";ctx.font="bold 14px monospace";ctx.fillText(String(aura).padStart(2,"0"),171,45);

  ctx.fillStyle="#9da4ae";ctx.font="8px monospace";ctx.fillText("CHECKPOINT",218,29);
  ctx.fillStyle="#f3d77d";ctx.font="bold 12px monospace";ctx.fillText((checkpoint+1)+"/2",267,44);

  ctx.fillStyle="#9da4ae";ctx.font="8px monospace";ctx.fillText("☰",320,39);

  ctx.fillStyle="rgba(8,11,17,.82)";ctx.fillRect(10,61,340,28);
  ctx.fillStyle="#e8dfc8";ctx.font="8px monospace";ctx.fillText(a.memory,18,79);

  // progress
  const got=collectibles.filter(c=>c.collected).length;
  ctx.fillStyle="#11151d";ctx.fillRect(10,96,340,5);
  ctx.fillStyle=a.accent;ctx.fillRect(10,96,340*(got/10),5);
}

function drawSword(p){
  ctx.save();
  ctx.translate(p.x+p.w/2,p.y+30);
  ctx.scale(p.facing,1);
  ctx.rotate(-.55);
  ctx.fillStyle="#e9eef1";ctx.fillRect(8,-4,35,7);
  ctx.fillStyle="#8793a1";ctx.fillRect(10,3,27,3);
  ctx.fillStyle="#6c4d38";ctx.fillRect(3,-2,8,5);
  ctx.fillStyle="#c4a35d";ctx.fillRect(0,-6,3,13);
  ctx.restore();
}

function drawKnight(x,y,w,h,facing=1,alpha=1){
  if(!drawTransparent(img.knight,x,y,w,h,facing<0,alpha)){
    ctx.fillStyle="#56616d";ctx.fillRect(x+8,y+14,w-16,h-18);
    ctx.fillStyle="#8aa9d2";ctx.fillRect(x+12,y+4,w-24,18);
    ctx.fillStyle="#b73d46";ctx.fillRect(x+5,y+34,w-10,5);
  }
}

function drawBear(x,y,w,h,facing=1,alpha=1){
  if(!drawTransparent(img.bear,x,y,w*1.18,h*1.25,facing<0,alpha)){
    ctx.fillStyle="#4a2c21";ctx.fillRect(x+8,y+12,w-16,h-10);
    ctx.fillStyle="#e3c0a1";ctx.fillRect(x+18,y+28,10,8);
  }
}
function drawTeacher(x,y,w,h,facing=1,alpha=1){
  if(!drawTransparent(img.teacher,x,y,w*1.2,h*1.25,facing<0,alpha)){
    ctx.fillStyle="#4b4b48";ctx.fillRect(x+8,y+10,w-16,h-10);
  }
}
function drawShadowBoss(x,y,w,h,facing=1,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;
  ctx.fillStyle="#171522";ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#d9879c";ctx.fillRect(x+16,y+22,7,7);ctx.fillRect(x+39,y+22,7,7);
  ctx.restore();
}

function drawStageClear(){
  ctx.fillStyle="rgba(3,5,9,.92)";ctx.fillRect(30,155,300,270);
  ctx.strokeStyle="#d0b878";ctx.strokeRect(30,155,300,270);
  ctx.fillStyle="#f5d77f";ctx.font="bold 16px monospace";ctx.textAlign="center";
  ctx.fillText("MEMORY CLEARED",180,205);
  ctx.fillStyle="#ddd7c7";ctx.font="10px monospace";
  ctx.fillText(arcs[arcIndex].name,180,229);
  ctx.fillText("THE ROAD CONTINUES",180,255);
  ctx.fillStyle="#9fa8b4";ctx.font="8px monospace";
  ctx.fillText("Checkpoint saved.",180,286);
  menuButton(75,345,210,52,arcIndex<2?"CONTINUE":"REUNION",true);
  ctx.textAlign="left";
}

function drawEnding(){
  ctx.fillStyle=skyGradient("#f3c9d6","#f7e8d2");ctx.fillRect(0,0,360,540);
  // soft petals/hearts
  for(let i=0;i<18;i++){
    const x=(i*71)%360, y=(i*39+endingTime*8)%470;
    ctx.fillStyle="rgba(255,255,255,.55)";ctx.fillRect(x,y,2,2);
  }
  ctx.fillStyle="rgba(112,74,93,.15)";ctx.fillRect(0,440,360,100);

  if(endingTime<2.7){
    drawKnight(player.x,420,46,66,1,1);
    drawTransparent(img.princess,255,395,58,82,false,1);
  } else {
    const kx=120, px=174;
    drawKnight(kx,420,46,66,1,1);
    drawTransparent(img.princess,px,395,58,82,true,1);
    if(endingTime>4.2){
      ctx.fillStyle="#ef6e8d";ctx.font="26px serif";ctx.textAlign="center";
      ctx.fillText("♥",180,350+Math.sin(endingTime*3)*4);
      ctx.fillStyle="#7a5362";ctx.font="10px monospace";
      ctx.fillText("TOGETHER",180,385);
    }
  }

  if(endingTime>5.2){
    ctx.fillStyle="rgba(20,11,18,.88)";ctx.fillRect(28,120,304,100);
    ctx.strokeStyle="#e0a9b9";ctx.strokeRect(28,120,304,100);
    ctx.fillStyle="#fff0dc";ctx.font="bold 11px monospace";ctx.textAlign="center";
    wrapText(CONFIG.finalMessage,180,157,260,17);
    ctx.fillStyle="#c8a6b3";ctx.font="8px monospace";
    ctx.fillText("TAP TO RETURN TO TITLE",180,204);
    ctx.textAlign="left";
  }
}

function wrapText(text,x,y,maxW,lineH){
  const words=text.split(" "); let line="";
  for(const word of words){
    const test=line?line+" "+word:word;
    if(ctx.measureText(test).width>maxW){
      ctx.fillText(line,x,y); y+=lineH; line=word;
    } else line=test;
  }
  if(line) ctx.fillText(line,x,y);
}

function toggleFullscreen(){
  const el=document.documentElement;
  if(!document.fullscreenElement){
    const p=el.requestFullscreen?.();
    if(p) p.catch(()=>showToast("FULLSCREEN BLOCKED BY BROWSER"));
    else showToast("FULLSCREEN NOT SUPPORTED");
  } else document.exitFullscreen?.();
}

function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*360/r.width,y:(e.clientY-r.top)*540/r.height};
}

canvas.addEventListener("pointerdown",e=>{
  e.preventDefault();
  const p=canvasPoint(e);
  handleCanvasTap(p.x,p.y);
},{passive:false});

function bindHold(btn,key){
  const down=e=>{e.preventDefault();keys[key]=true;btn.classList.add("pressed")};
  const up=e=>{e.preventDefault();keys[key]=false;btn.classList.remove("pressed")};
  btn.addEventListener("pointerdown",down,{passive:false});
  btn.addEventListener("pointerup",up,{passive:false});
  btn.addEventListener("pointercancel",up,{passive:false});
  btn.addEventListener("pointerleave",up,{passive:false});
}
bindHold(buttons.left,"left");
bindHold(buttons.right,"right");

function bindAction(btn,key){
  btn.addEventListener("pointerdown",e=>{
    e.preventDefault(); keys[key]=true; just[key]=true; btn.classList.add("pressed");
  },{passive:false});
  const up=e=>{e.preventDefault();keys[key]=false;btn.classList.remove("pressed")};
  btn.addEventListener("pointerup",up,{passive:false});
  btn.addEventListener("pointercancel",up,{passive:false});
}
bindAction(buttons.jump,"jump");
bindAction(buttons.act,"act");

window.addEventListener("keydown",e=>{
  if(e.repeat) return;
  if(e.code==="ArrowLeft"||e.key==="a") keys.left=true;
  if(e.code==="ArrowRight"||e.key==="d") keys.right=true;
  if(e.code==="Space"||e.key==="w"||e.code==="ArrowUp") just.jump=true;
  if(e.key==="z"||e.key==="x"||e.key==="Enter") just.act=true;
  if(e.key==="f") toggleFullscreen();
});
window.addEventListener("keyup",e=>{
  if(e.code==="ArrowLeft"||e.key==="a") keys.left=false;
  if(e.code==="ArrowRight"||e.key==="d") keys.right=false;
});

document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});
document.addEventListener("gesturestart",e=>e.preventDefault());

document.addEventListener("fullscreenchange",()=>{
  setTimeout(()=>resize(),50);
});

function resize(){
  const shell=document.getElementById("gameShell");
  const frame=document.getElementById("gameFrame");
  const maxH=Math.max(240,window.innerHeight-154);
  frame.style.maxHeight=maxH+"px";
  // Canvas itself stays logical 360x540 and CSS scales proportionally.
}
window.addEventListener("resize",resize);
window.addEventListener("orientationchange",()=>setTimeout(resize,100));

let last=performance.now();
function loop(now){
  const dt=Math.min(.033,(now-last)/1000); last=now;
  just.jump=just.jump||false;
  update(dt);
  draw();
  just.jump=false;
  just.act=false;
  requestAnimationFrame(loop);
}

loadAssets().then(()=>{
  resize();
  requestAnimationFrame(loop);
});
})();
