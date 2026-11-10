/* Layout: full-bleed 3D canvas; HUD pinned to the safe-area corners; menus as centred veils. */
export const CSS = `
:root{--ink:#07060b;--ink2:#14101f;--gold:#e3b765;--gold2:#8a6a2c;--violet:#9a6bff;--cyan:#62e8ff;--text:#f4ecdc;--dim:#a79fb5;
--display:"Cinzel","Trajan Pro","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;--ui:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:dark}
html,body{height:100%;overflow:hidden;overscroll-behavior:none;background:var(--ink);color:var(--text)}
#vr{position:fixed;inset:0;font-family:var(--ui);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;-webkit-tap-highlight-color:transparent;overflow:hidden;background:var(--ink)}
#vr [hidden]{display:none!important}
#vr::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(7,6,11,.5))}
#vr canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#vr button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;touch-action:manipulation}
#vr button:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
.vr-layer{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none;
padding:calc(14px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) calc(18px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.vr-layer>*{pointer-events:auto}
.vr-veil{align-items:center;justify-content:center;gap:22px;text-align:center;background:radial-gradient(120% 80% at 50% 40%,rgba(7,6,11,.25),rgba(7,6,11,.86));animation:vr-in .35s ease-out both}
.vr-veil.solid{background:radial-gradient(120% 80% at 50% 40%,rgba(20,16,31,.82),rgba(7,6,11,.95))}
@keyframes vr-in{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:none}}
.vr-title{font-family:var(--display);font-weight:700;font-size:clamp(46px,15vw,104px);letter-spacing:.16em;margin:0 0 0 .16em;line-height:1;
background:linear-gradient(180deg,#fff3cf 10%,var(--gold) 55%,var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 22px rgba(154,107,255,.55))}
.vr-sub{font-family:var(--display);letter-spacing:.5em;margin:6px 0 0 .5em;font-size:clamp(11px,3.2vw,16px);color:var(--cyan);text-shadow:0 0 12px rgba(98,232,255,.6)}
.vr-h{font-family:var(--display);font-size:clamp(26px,8vw,44px);letter-spacing:.2em;margin:0 0 0 .2em;color:var(--gold)}
.vr-btn{min-width:230px;min-height:56px;padding:0 34px!important;font-family:var(--display)!important;font-size:19px!important;letter-spacing:.3em;text-indent:.3em;color:var(--ink)!important;
background:linear-gradient(180deg,#f6dc9c,var(--gold) 60%,#b98a3a)!important;clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,14px 100%,0 50%);transition:transform .12s,filter .12s}
.vr-btn:active{transform:scale(.96);filter:brightness(1.2)}
.vr-btn.ghost{background:none!important;color:var(--gold)!important;box-shadow:inset 0 0 0 1px var(--gold2);clip-path:none;border-radius:2px;min-height:48px;font-size:15px!important}
.vr-stats{display:grid;grid-template-columns:repeat(3,minmax(84px,1fr));gap:10px 18px;font-variant-numeric:tabular-nums}
.vr-stat b{display:block;font-family:var(--display);font-size:clamp(22px,6.5vw,32px);color:var(--text);font-weight:600}
.vr-stat span,.vr-label{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--dim)}
.vr-record{font-family:var(--display);letter-spacing:.3em;color:var(--cyan);text-shadow:0 0 14px rgba(98,232,255,.7);animation:vr-pulse 1s ease-in-out infinite alternate}
@keyframes vr-pulse{to{opacity:.55}}
.vr-help{background:rgba(7,6,11,.72);padding:12px 18px;box-shadow:inset 0 0 0 1px rgba(227,183,101,.28);display:grid;grid-template-columns:auto auto;gap:6px 14px;font-size:13px;color:var(--dim);text-align:left;align-items:center}
.vr-help i{font-style:normal;color:var(--gold);font-family:var(--display);letter-spacing:.1em;text-align:right}
.vr-corner{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:max(14px,env(safe-area-inset-right,0px));display:flex;gap:10px}
.vr-icon{width:44px;height:44px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(227,183,101,.5);background:rgba(7,6,11,.45)!important;color:var(--gold)!important;font-size:17px!important;display:grid;place-items:center}
.vr-ver{position:absolute;bottom:calc(10px + env(safe-area-inset-bottom,0px));left:0;right:0;text-align:center;font-size:10px;letter-spacing:.2em;color:rgba(167,159,181,.6)}
/* HUD */
.vr-hud{justify-content:space-between}
.vr-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;font-variant-numeric:tabular-nums;text-shadow:0 1px 3px rgba(7,6,11,.95),0 0 12px rgba(7,6,11,.7)}
.vr-top .vr-label{color:var(--text)}
.vr-hud,.vr-hud *{pointer-events:none}
#vr .vr-hud button{pointer-events:auto}
.vr-big{font-family:var(--display);font-size:clamp(24px,7.5vw,36px);font-weight:700;line-height:1;color:var(--text)}
.vr-big small{font-size:.5em;color:var(--gold);margin-left:3px;letter-spacing:.1em}
.vr-frag{color:var(--gold);font-family:var(--display);font-size:clamp(18px,5.5vw,26px);font-weight:600;display:flex;align-items:center;gap:7px;justify-content:flex-end}
.vr-frag::before{content:"";width:.6em;height:.6em;background:linear-gradient(135deg,#fff0b8,var(--gold));transform:rotate(45deg);box-shadow:0 0 10px var(--gold)}
.vr-right{display:flex;gap:12px;align-items:flex-start}
.vr-bottom{display:flex;justify-content:center;align-items:flex-end}
.vr-dash{width:74px;height:74px;border-radius:50%;position:relative;display:grid;place-items:center;background:rgba(7,6,11,.5)!important;
font-family:var(--display)!important;font-size:11px!important;letter-spacing:.14em;color:var(--dim)!important;transition:transform .12s}
.vr-dash svg{position:absolute;inset:0;transform:rotate(-90deg)}
.vr-dash circle{fill:none;stroke-width:3}
.vr-dash .bg{stroke:rgba(244,236,220,.16)}
.vr-dash .fg{stroke:var(--cyan);stroke-linecap:round;transition:stroke .2s}
.vr-dash.ready{color:var(--cyan)!important;box-shadow:0 0 22px rgba(98,232,255,.55)}
.vr-dash.ready .fg{stroke:var(--cyan);filter:drop-shadow(0 0 4px var(--cyan))}
.vr-dash:active{transform:scale(.92)}
.vr-tip{position:absolute;left:0;right:0;top:30%;text-align:center;font-family:var(--display);font-size:clamp(17px,5.4vw,26px);letter-spacing:.22em;color:var(--text);
text-shadow:0 0 16px rgba(154,107,255,.9),0 2px 8px rgba(7,6,11,.9);pointer-events:none;transition:opacity .3s}
.vr-debug{position:absolute;left:max(8px,env(safe-area-inset-left,0px));top:calc(96px + env(safe-area-inset-top,0px));font:11px/1.35 ui-monospace,Menlo,monospace;color:var(--cyan);background:rgba(7,6,11,.7);padding:6px 8px;white-space:pre;pointer-events:none}
/* Portal white-out */
.vr-flash{position:absolute;inset:0;z-index:30;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 55%,#fff 0,#fff 20%,rgba(150,235,255,.94) 48%,rgba(255,80,220,.8) 100%)}
/* Loading screen */
.vr-splash{position:absolute;inset:0;z-index:60;background:#07060b center 32%/cover no-repeat;display:flex;flex-direction:column;align-items:center;text-align:center;
padding:calc(11% + env(safe-area-inset-top,0px)) 16px 0;transition:opacity .8s ease}
.vr-splash::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,6,11,.78),rgba(7,6,11,.1) 36%,rgba(7,6,11,0) 66%,rgba(7,6,11,.8))}
.vr-splash.out{opacity:0;pointer-events:none}
.vr-splash-head{position:relative}
.vr-load{position:absolute;left:16%;right:16%;bottom:calc(7% + env(safe-area-inset-bottom,0px));height:3px;border-radius:2px;background:rgba(244,236,220,.22);overflow:hidden}
.vr-load i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--gold2),var(--gold));box-shadow:0 0 10px var(--gold);transition:width .3s ease}
@media (prefers-reduced-motion:reduce){.vr-veil,.vr-record{animation:none}}
`;
