/* 학생용 페이지 배경 움직임 (개강안내 · 과제 제출 공용)
   배경 그림(icons/bg-lounge.jpg · 1800×1100) 위에: 창밖 비 · 유리창을 타고 흐르는 빗방울 · 건물 창 불빛 반짝임 · 가끔 지나가는 차 불빛.
   초당 24장 · 화면이 안 보일 땐 멈춤 · '동작 줄이기' 설정이면 한 장만 그려요. */
(function(){
  var IW=1800, IH=1100, WIN=[[0.2567,0.1845,0],[0.5856,0.3118,0],[0.8322,0.3882,0],[0.7583,0.1655,0],[0.5367,0.5136,0],[0.5089,0.4773,0],[0.7428,0.4264,0],[0.2256,0.3436,0],[0.5867,0.4645,0],[0.5056,0.1718,0],[0.5733,0.4618,0],[0.6728,0.4582,0],[0.1906,0.4773,0],[0.2261,0.3582,0],[0.2083,0.37,0],[0.1906,0.4327,0],[0.4939,0.1973,0],[0.9394,0.4664,0],[0.5094,0.1718,0],[0.7544,0.1782,0],[0.4394,0.4645,0],[0.49,0.5018,0],[0.6028,0.5018,0],[0.1911,0.4727,0],[0.6561,0.42,0],[0.7583,0.1845,0],[0.2606,0.5282,0],[0.2261,0.3845,0],[0.4394,0.4627,0],[0.5094,0.1845,0],[0.8611,0.4255,0],[0.6917,0.4582,0],[0.5289,0.3436,0],[0.7539,0.1636,0],[0.7383,0.1982,0],[0.5094,0.49,0],[0.1544,0.4473,0],[0.665,0.4945,0],[0.6844,0.5091,0],[0.6994,0.4827,0],[0.5,0.1782,0],[0.5639,0.3336,0],[0.2489,0.1909,0],[0.8033,0.3373,0],[0.6772,0.4964,0],[0.4839,0.1927,0],[0.4822,0.3864,0],[0.2606,0.1718,0],[0.7133,0.4545,0],[0.5017,0.1718,0],[0.2567,0.1782,0],[0.6917,0.4036,0],[0.1556,0.4355,0],[0.7622,0.1918,0],[0.2317,0.5227,0],[0.4511,0.4264,0],[0.5,0.1718,0],[0.6628,0.4327,0],[0.2506,0.1845,0],[0.6272,0.4809,0],[0.5444,0.49,0],[0.6917,0.4455,0],[0.7544,0.1909,0],[0.155,0.4364,0],[0.48,0.4627,0],[0.2489,0.1655,0],[0.7711,0.4218,0],[0.7533,0.1782,0],[0.2411,0.4364,0],[0.2217,0.3945,0],[0.8556,0.3882,0],[0.5094,0.4882,0],[0.2606,0.1973,0],[0.5056,0.1973,0],[0.3606,0.5173,0],[0.4822,0.1973,0],[0.2256,0.42,0],[0.6922,0.4455,0],[0.5017,0.1782,0],[0.7583,0.1909,0],[0.2606,0.1782,0],[0.5094,0.5027,0],[0.1694,0.4718,0],[0.6561,0.4455,0],[0.455,0.4236,0],[0.8606,0.4264,0],[0.2256,0.4182,0],[0.7094,0.3682,0],[0.5333,0.3182,0],[0.2061,0.4345,0],[0.2411,0.3709,0],[0.6633,0.5091,0],[0.4828,0.3882,0],[0.6917,0.4545,0],[0.4583,0.4136,0],[0.7,0.4836,0],[0.2178,0.49,0],[0.3267,0.4964,0],[0.5961,0.5155,0],[0.3894,0.5091,0],[0.2411,0.1973,0],[0.2372,0.1918,0],[0.5628,0.3327,0],[0.5589,0.3864,0],[0.7506,0.1909,0],[0.4744,0.4645,0],[0.2083,0.3682,0],[0.8039,0.3355,0],[0.4817,0.1936,0],[0.5639,0.3436,0],[0.7489,0.4645,0],[0.6728,0.4555,0],[0.39,0.4836,0],[0.1906,0.4391,0],[0.5333,0.4373,0],[0.4978,0.1973,0],[0.695,0.2982,0],[0.2311,0.1973,0],[0.2528,0.1909,0],[0.3989,0.3945,0],[0.5583,0.3155,0],[0.495,0.5018,0],[0.735,0.5155,0],[0.7467,0.1909,0],[0.685,0.4545,0],[0.49,0.3882,0],[0.2606,0.1845,0],[0.6556,0.4964,0],[0.7544,0.1636,0],[0.25,0.1782,0],[0.6378,0.3945,0],[0.245,0.1909,0],[0.4883,0.3845,0],[0.71,0.3609,0],[0.26,0.4718,0],[0.2178,0.51,0],[0.4917,0.1909,0],[0.2567,0.1636,0],[0.2744,0.4836,0],[0.2294,0.3336,0],[0.5094,0.1973,0],[0.3039,0.4836,0],[0.5333,0.3145,0],[0.5522,0.35,0],[0.6994,0.5227,0],[0.7422,0.4264,0],[0.6844,0.4836,0],[0.6561,0.4945,0],[0.3294,0.4018,0],[0.4611,0.2918,0],[0.3683,0.4973,1],[0.3694,0.4973,1],[0.4261,0.4818,1],[0.3678,0.4945,1],[0.3694,0.4927,1]];
  var G={x0:.055,x1:.945,y0:.06,y1:.6,road:.6-(.54*.13)};
  var cv=document.createElement('canvas'); cv.className='scene-fx'; cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  var sc=document.querySelector('.scene'); if(sc&&sc.parentNode) sc.parentNode.insertBefore(cv,sc.nextSibling); else document.body.prepend(cv);
  var x=cv.getContext('2d'), W=0,H=0,dpr=1,s=1,ox=0,oy=0, rain=[],drops=[],lights=[],cars=[],nextCar=2,last=0,pt=0;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function P(u,v){ return [ox+u*IW*s, oy+v*IH*s]; }
  function size(){ dpr=Math.min(1.5,devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); x.setTransform(dpr,0,0,dpr,0,0);
    s=Math.max(W/IW,H/IH); ox=(W-IW*s)/2; oy=(H-IH*s)/2;
    var n=Math.round(Math.min(220,90*Math.sqrt(W*H)/900));
    rain=[]; for(var i=0;i<n;i++) rain.push({u:Math.random(),v:Math.random(),l:.025+Math.random()*.05,sp:.55+Math.random()*.6,a:.08+Math.random()*.14});
    drops=[]; for(var j=0;j<Math.round(10+W/120);j++) drops.push({u:G.x0+Math.random()*(G.x1-G.x0),v:G.y0+Math.random()*(G.y1-G.y0),r:1.2+Math.random()*1.8,vel:0,wait:Math.random()*6,tr:[]});
    lights=WIN.map(function(p){ return {u:p[0],v:p[1],c:p[2],ph:Math.random()*6.3,sp:.3+Math.random()*1.4,blink:Math.random()<.16,off:Math.random()*40}; });
    frame(performance.now(),true); }
  function frame(now,force){ var t=now/1000; if(!force&&t-last<1/24) return; last=t; var dt=Math.min(.1,t-(pt||t)); pt=t;
    x.clearRect(0,0,W,H);
    var a=P(G.x0,G.y0), b=P(G.x1,G.y1), ww=b[0]-a[0], wh=b[1]-a[1];
    x.save(); x.beginPath(); x.rect(a[0],a[1],ww,wh); x.clip();
    /* 건물 창 불빛 반짝임 */
    x.globalCompositeOperation='screen';
    for(var i=0;i<lights.length;i++){ var L=lights[i]; var k=Math.sin(t*L.sp+L.ph); var al;
      if(L.blink){ var cyc=((t+L.off)%14); al=cyc<1.2?0:(.35+.15*k); } else al=.12+.16*k; if(al<=.02) continue;
      var q=P(L.u,L.v), r=Math.max(2.5,5*s*1.3); var g=x.createRadialGradient(q[0],q[1],0,q[0],q[1],r*2.2);
      var col=L.c?'170,205,255':'255,214,150'; g.addColorStop(0,'rgba('+col+','+al+')'); g.addColorStop(1,'rgba('+col+',0)'); x.fillStyle=g; x.fillRect(q[0]-r*2.2,q[1]-r*2.2,r*4.4,r*4.4); }
    x.globalCompositeOperation='source-over';
    /* 지나가는 차 불빛 */
    if(t>nextCar){ var dir=Math.random()<.5?1:-1; cars.push({u:dir>0?-.05:1.05,dir:dir,sp:.045+Math.random()*.04,head:Math.random()<.55,v:.35+Math.random()*.5}); nextCar=t+5+Math.random()*7; }
    var ry=P(0,G.road)[1], rb=b[1];
    cars=cars.filter(function(c){ c.u+=c.dir*c.sp*dt; if(c.u<-.1||c.u>1.1) return false; var cy=ry+(rb-ry)*c.v*.55; var col=c.head?'255,240,205':'255,70,60';
      [0,1].forEach(function(o){ var cx=a[0]+(c.u+(o?.02:0))*ww, rr=Math.max(4,14*s); var g=x.createRadialGradient(cx,cy,0,cx,cy,rr*3); g.addColorStop(0,'rgba('+col+',.85)'); g.addColorStop(.2,'rgba('+col+',.35)'); g.addColorStop(1,'rgba('+col+',0)'); x.fillStyle=g; x.fillRect(cx-rr*3,cy-rr*3,rr*6,rr*6);
        var lg=x.createLinearGradient(0,cy,0,rb); lg.addColorStop(0,'rgba('+col+',.3)'); lg.addColorStop(1,'rgba('+col+',0)'); x.fillStyle=lg; x.fillRect(cx-rr*.5,cy,rr,rb-cy); }); return true; });
    /* 창밖 비 */
    x.lineCap='round'; x.lineWidth=Math.max(1,1.1*s);
    for(var j=0;j<rain.length;j++){ var R=rain[j]; if(!reduce){ R.v+=R.sp*dt; if(R.v>1.08) R.v=-.08; }
      var px=a[0]+R.u*ww+R.v*wh*.07, py=a[1]+R.v*wh; x.strokeStyle='rgba(205,218,240,'+R.a+')'; x.beginPath(); x.moveTo(px,py); x.lineTo(px-wh*R.l*.07,py-wh*R.l); x.stroke(); }
    /* 유리창 빗방울 */
    for(var d=0;d<drops.length;d++){ var D=drops[d]; var q2=P(D.u,D.v), rr2=D.r*Math.max(.8,s*1.4);
      if(!reduce){ if(D.wait>0) D.wait-=dt; else { D.vel=Math.min(.12,D.vel+.02*dt); D.v+=D.vel*dt*(.6+.4*Math.sin(t*3+D.u*50)); D.u+=Math.sin(t*1.7+D.v*40)*.00007; D.tr.push([D.u,D.v]); if(D.tr.length>26) D.tr.shift();
        if(D.v>G.y1+.01){ D.v=G.y0+Math.random()*(G.y1-G.y0)*.4; D.u=G.x0+Math.random()*(G.x1-G.x0); D.vel=0; D.wait=1.5+Math.random()*6; D.tr=[]; } } }
      if(D.tr.length>2){ x.strokeStyle='rgba(225,232,245,.10)'; x.lineWidth=rr2*.9; x.beginPath(); var s0=P(D.tr[0][0],D.tr[0][1]); x.moveTo(s0[0],s0[1]); for(var z=1;z<D.tr.length;z++){ var sz=P(D.tr[z][0],D.tr[z][1]); x.lineTo(sz[0],sz[1]); } x.stroke(); }
      x.fillStyle='rgba(8,12,20,.35)'; x.beginPath(); x.arc(q2[0],q2[1]+rr2*.3,rr2*1.15,0,7); x.fill(); x.fillStyle='rgba(255,236,210,.45)'; x.beginPath(); x.arc(q2[0]-rr2*.35,q2[1]-rr2*.35,rr2*.5,0,7); x.fill(); }
    x.restore(); }
  function loop(now){ if(!document.hidden) frame(now); if(!reduce) requestAnimationFrame(loop); }
  addEventListener('resize',function(){ clearTimeout(size._t); size._t=setTimeout(size,120); });
  size(); if(!reduce) requestAnimationFrame(loop);
})();
