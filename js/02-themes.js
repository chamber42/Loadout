'use strict';
/* ============================================================
   LOADOUT - THEMES
   From app.js lines 41-270 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     THEMES
     Each genre gets its own palette, type pairing and vocabulary.
     Display faces vary wildly in optical size — Press Start 2P is a
     pixel font that runs tiny, Cinzel runs large — so every theme
     carries a scale factor rather than relying on one fixed size.
  ========================================================= */
  const THEMES = {
    cyberpunk: {
      tiers:["Netrunner", "Techie", "Fixer", "Nomad", "Psycho"],
      wash:"radial-gradient(ellipse at top, #10202b 0%, #0a0e14 55%), repeating-linear-gradient(0deg, rgba(0,255,242,0.018) 0px, rgba(0,255,242,0.018) 1px, transparent 1px, transparent 4px)",
      name:"Cyberpunk", icon:"city",
      blurb:"Neon, chrome and bad decisions at 3am",
      fonts:{ display:"'Press Start 2P', monospace", body:"'Share Tech Mono', 'Courier New', monospace", scale:1, spacing:"1px" },
      sizes:{ "fs-6":"6px", "fs-7":"7px", "fs-8":"8px", "fs-9":"8px", "fs-10":"9px", "fs-11":"10px", "fs-12":"11px", "fs-13":"12px", "fs-18":"14px", "fs-body":"13px" },
      glow:"none", accentSoft:"rgba(0,255,242,.10)", accentLine:"rgba(0,255,242,.45)",
      colors:{ "bg-0":"#0a0e14","bg-1":"#0d1420","panel":"#111a27","panel-2":"#0e1622","line":"#1e2c3d",
               "cyan":"#00fff2","green":"#39ff88","amber":"#ffb000","red":"#ff3860","magenta":"#ff2fb0",
               "text":"#dff3ff","muted":"#95a6b9" },
      sheet:"OPERATOR SCREEN", sheetTitle:"Your Build",
      words:{ tier:"TIER", loadout:"LOADOUT", quest:"QUEST", journal:"INTAKE", stat:"STAT", inventory:"INVENTORY",
              build:"BUILD YOUR LOADOUT", charCreate:"CHARACTER CREATION", hp:"KCAL", playstyle:"PLAYSTYLE",
              meals:"Assemble Your Meals", tierPick:"Choose Your Tier" }
    },
    fantasy: {
      tiers:["Rogue", "Ranger", "Cleric", "Paladin", "Barbarian"],
      wash:"radial-gradient(ellipse at top, #221a10 0%, #14100a 60%)",
      name:"High Fantasy", icon:"sword",
      blurb:"Gilded scrollwork and hard-won glory",
      fonts:{ display:"'Cinzel', Georgia, serif", body:"'EB Garamond', Georgia, serif", scale:1.9, spacing:"0.5px" },
      sizes:{ "fs-6":"10px", "fs-7":"11px", "fs-8":"12px", "fs-9":"13px", "fs-10":"14px", "fs-11":"15px", "fs-12":"16px", "fs-13":"17px", "fs-18":"25px", "fs-body":"14px" },
      glow:"none", accentSoft:"rgba(232,201,119,.10)", accentLine:"rgba(232,201,119,.45)",
      colors:{ "bg-0":"#14100a","bg-1":"#1c160d","panel":"#241c11","panel-2":"#1e1710","line":"#3d3320",
               "cyan":"#e8c977","green":"#8fbf6a","amber":"#d9a441","red":"#c0483c","magenta":"#a86fbf",
               "text":"#f2e6cf","muted":"#bfb39f" },
      sheet:"CHARACTER SHEET", sheetTitle:"Your Character",
      words:{ tier:"RANK", loadout:"PROVISIONS", quest:"QUEST", journal:"CHRONICLE", stat:"ATTRIBUTE", inventory:"LARDER",
              build:"Forge Your Provisions", charCreate:"CHARACTER CREATION", hp:"VIGOUR", playstyle:"DISCIPLINE",
              meals:"Lay Out Your Feast", tierPick:"Choose Your Rank" }
    },
    fps: {
      tiers:["Recon", "Medic", "Engineer", "Assault", "Tank"],
      wash:"linear-gradient(180deg, #15181a 0%, #0e0f10 45%)",
      name:"Tactical FPS", icon:"crosshair",
      blurb:"Matte black, orange accents, zero nonsense",
      fonts:{ display:"'Rajdhani', 'Arial Narrow', sans-serif", body:"'Barlow Condensed', 'Arial Narrow', sans-serif", scale:2.0, spacing:"1.5px" },
      sizes:{ "fs-6":"11px", "fs-7":"12px", "fs-8":"13px", "fs-9":"14px", "fs-10":"15px", "fs-11":"16px", "fs-12":"18px", "fs-13":"19px", "fs-18":"29px", "fs-body":"16px" },
      glow:"none", accentSoft:"rgba(255,140,26,.10)", accentLine:"rgba(255,140,26,.45)",
      colors:{ "bg-0":"#0e0f10","bg-1":"#141617","panel":"#1a1d1f","panel-2":"#151819","line":"#2b3033",
               "cyan":"#ff8c1a","green":"#5ec26a","amber":"#e8b62c","red":"#e0463c","magenta":"#7fa8c9",
               "text":"#e6eaec","muted":"#9da9ae" },
      sheet:"OPERATOR DOSSIER", sheetTitle:"Your Operator",
      words:{ tier:"CLASS", loadout:"LOADOUT", quest:"OBJECTIVE", journal:"SITREP", stat:"METRIC", inventory:"ARMORY",
              build:"Configure Your Loadout", charCreate:"OPERATOR SETUP", hp:"FUEL", playstyle:"DOCTRINE",
              meals:"Build Your Loadout", tierPick:"Select Your Class" }
    },
    survival: {
      tiers:["Scavenger", "Wanderer", "Scrapper", "Raider", "Juggernaut"],
      wash:"radial-gradient(ellipse at top, #17210f 0%, #0a0d08 62%)",
      name:"Post-Apocalyptic", icon:"radiation",
      blurb:"Green haze, scavenged gear and something moving in the stairwell",
      fonts:{ display:"'Special Elite', 'Courier New', monospace", body:"'Share Tech Mono', 'Courier New', monospace", scale:1.65, spacing:"0.8px" },
      sizes:{ "fs-6":"9px", "fs-7":"10px", "fs-8":"11px", "fs-9":"12px", "fs-10":"13px", "fs-11":"14px", "fs-12":"15px", "fs-13":"16px", "fs-18":"24px", "fs-body":"13px" },
      glow:"0 0 9px rgba(182,224,39,.3)", accentSoft:"rgba(182,224,39,.11)", accentLine:"rgba(182,224,39,.42)",
      colors:{ "bg-0":"#0a0d08","bg-1":"#10150e","panel":"#161d13","panel-2":"#111710","line":"#36421f",
               "cyan":"#b6e027","green":"#7fbf3f","amber":"#e3b23c","red":"#c4442a","magenta":"#94853f",
               "text":"#e7efd6","muted":"#9ea994" },
      sheet:"SURVIVOR PROFILE", sheetTitle:"Your Survivor",
      words:{ tier:"GRADE", loadout:"SUPPLY RUN", quest:"TASK", journal:"RATIONS", stat:"READOUT", inventory:"STASH",
              build:"Plan Your Supply Run", charCreate:"SURVIVOR PROFILE", hp:"RATIONS", playstyle:"APPROACH",
              meals:"Ration Out Your Day", tierPick:"Choose Your Grade" }
    },
    farm: {
      /* Named for the flower bed rather than the people working it, so the
         ladder climbs by how big the bloom grows: a violet low to the ground
         up to a sunflower you have to look up at. */
      tiers:["Violet","Daisy","Tulip","Hollyhock","Sunflower"],
      wash:"radial-gradient(ellipse at top, #2b3d1e 0%, #111c0f 62%)",
      name:"Farm Life Sim", icon:"flower",
      blurb:"Sunlit fields and nothing but time",
      fonts:{ display:"'Fredoka', 'Trebuchet MS', sans-serif", body:"'Nunito', 'Trebuchet MS', sans-serif", scale:1, spacing:"0.5px" },
      sizes:{ "fs-6":"10px","fs-7":"11px","fs-8":"13px","fs-9":"14px","fs-10":"15px","fs-11":"16px","fs-12":"17px","fs-13":"18px","fs-18":"26px","fs-body":"14px" },
      glow:"0 1px 0 rgba(0,0,0,.4)", accentSoft:"rgba(245,184,208,.14)", accentLine:"rgba(245,184,208,.50)",
      /* Flowers, fruit and veg. The fields stay green, but the accents are a
         flower bed: blossom pink leads, with sunflower yellow, tomato red and
         cornflower blue behind it. Note the "magenta" slot carries the blue --
         these keys are generic accent slots, not descriptions of the hue.
         Green stays a supporting colour here; it is the lead in no theme now,
         which is what stops this reading as the same palette as craft. */
      colors:{ "bg-0":"#111c0f","bg-1":"#18280f","panel":"#1e2b16","panel-2":"#182312","line":"#35492a",
               "cyan":"#f5b8d0","green":"#8fd46a","amber":"#ffd166","red":"#ef6f6c","magenta":"#7fb8e8",
               "text":"#f6f2e4","muted":"#a9b898" },
      sheet:"FARMER ALMANAC", sheetTitle:"Your Farmer",
      words:{ tier:"SEASON", loadout:"HARVEST", quest:"CHORE", journal:"DAYBOOK", stat:"YIELD", inventory:"ROOT CELLAR",
              build:"Plan Your Harvest", charCreate:"NEW FARMER", hp:"STAMINA", playstyle:"FARMING STYLE",
              meals:"Lay Out Your Table", tierPick:"Choose Your Season" }
    },
    craft: {
      tiers:["Forager","Miner","Crafter","Blacksmith","Artisan"],
      wash:"linear-gradient(180deg, #241c12 0%, #14100b 55%)",
      name:"Survival Craft", icon:"pick",
      blurb:"Punch trees, build base, fear the dark",
      fonts:{ display:"'Silkscreen', 'Courier New', monospace", body:"'VT323', 'Courier New', monospace", scale:1, spacing:"1px" },
      sizes:{ "fs-6":"11px","fs-7":"12px","fs-8":"13px","fs-9":"14px","fs-10":"15px","fs-11":"16px","fs-12":"17px","fs-13":"18px","fs-18":"25px","fs-body":"16px" },
      glow:"none", accentSoft:"rgba(217,160,94,.13)", accentLine:"rgba(217,160,94,.48)",
      /* Timber and torchlight. This genre is about felling a forest and
         building from it, so the surfaces are bark and cut plank and the lead
         accent is planed timber, not leaf. Foliage green is demoted to a
         supporting role -- it was previously the primary here AND in farm,
         which is why the two themes were hard to tell apart. */
      colors:{ "bg-0":"#14100b","bg-1":"#1c1710","panel":"#241d14","panel-2":"#1c1710","line":"#453722",
               "cyan":"#d9a05e","green":"#7fb054","amber":"#e8a838","red":"#c96c50","magenta":"#9fb0c4",
               "text":"#f0e6d8","muted":"#b8ab99" },
      sheet:"PLAYER STATS", sheetTitle:"Your Player",
      words:{ tier:"LEVEL", loadout:"HOTBAR", quest:"TASK", journal:"HUNGER", stat:"BAR", inventory:"CHEST",
              build:"Fill Your Hotbar", charCreate:"NEW WORLD", hp:"HEARTS", playstyle:"DIFFICULTY",
              meals:"Stock Your Hotbar", tierPick:"Choose Your Level" }
    },
    outdoors: {
      tiers:["Angler","Trapper","Tracker","Marksman","Outfitter"],
      wash:"radial-gradient(ellipse at top, #16241f 0%, #0d1512 60%)",
      name:"Fishing & Hunting", icon:"fish",
      blurb:"Cold mornings, still water, long waits",
      fonts:{ display:"'Roboto Slab', Georgia, serif", body:"'Lato', 'Helvetica Neue', sans-serif", scale:1, spacing:"0.5px" },
      sizes:{ "fs-6":"10px","fs-7":"11px","fs-8":"12px","fs-9":"13px","fs-10":"15px","fs-11":"16px","fs-12":"17px","fs-13":"18px","fs-18":"26px","fs-body":"13px" },
      glow:"0 1px 0 rgba(0,0,0,.5)", accentSoft:"rgba(226,138,58,.12)", accentLine:"rgba(226,138,58,.45)",
      colors:{ "bg-0":"#0d1512","bg-1":"#131e1a","panel":"#182620","panel-2":"#131e1a","line":"#2a3a32",
               "cyan":"#e28a3a","green":"#7fb069","amber":"#e0b445","red":"#c35b4a","magenta":"#8ab6c9",
               "text":"#eef2ec","muted":"#a1b1a8" },
      sheet:"FIELD CARD", sheetTitle:"Your License",
      words:{ tier:"TAG", loadout:"KIT", quest:"OUTING", journal:"MESS", stat:"READING", inventory:"COOLER",
              build:"Pack Your Kit", charCreate:"LICENSE APPLICATION", hp:"ENERGY", playstyle:"APPROACH",
              meals:"Pack Your Kit", tierPick:"Choose Your Tag" }
    },
    horror: {
      tiers:["Bystander","Survivor","Investigator","Hunter","Slayer"],
      wash:"radial-gradient(ellipse at top, #1a0f11 0%, #0b0709 62%)",
      name:"Horror", icon:"candle",
      blurb:"Something is in the dark with you",
      fonts:{ display:"'Metamorphous', Georgia, serif", body:"'Crimson Text', Georgia, serif", scale:1, spacing:"1px" },
      sizes:{ "fs-6":"10px","fs-7":"11px","fs-8":"12px","fs-9":"13px","fs-10":"14px","fs-11":"16px","fs-12":"17px","fs-13":"18px","fs-18":"25px","fs-body":"15px" },
      glow:"0 0 14px rgba(200,60,60,.20)", accentSoft:"rgba(197,58,58,.14)", accentLine:"rgba(197,58,58,.50)",
      colors:{ "bg-0":"#0b0709","bg-1":"#120d0f","panel":"#181113","panel-2":"#120d0f","line":"#332226",
               "cyan":"#e05a5a","green":"#8fae76","amber":"#d19a3c","red":"#e04a4a","magenta":"#9a6ba8",
               "text":"#ece2e2","muted":"#ab9c9e" },
      sheet:"CASE FILE", sheetTitle:"Your Case File",
      words:{ tier:"CHAPTER", loadout:"SUPPLIES", quest:"NIGHT", journal:"INTAKE", stat:"VITALS", inventory:"SATCHEL",
              build:"Ready Your Supplies", charCreate:"THE VICTIM", hp:"SANITY", playstyle:"DISPOSITION",
              meals:"Ration What's Left", tierPick:"Choose Your Chapter" }
    },
    racing: {
      tiers:["Novice","Privateer","Pro","Ace","Legend"],
      wash:"linear-gradient(180deg, #16181c 0%, #0c0d10 48%)",
      name:"Racing", icon:"flag",
      blurb:"Carbon, apexes and tenths of a second",
      fonts:{ display:"'Racing Sans One', 'Arial Narrow', sans-serif", body:"'Titillium Web', 'Helvetica Neue', sans-serif", scale:1, spacing:"1px" },
      sizes:{ "fs-6":"11px","fs-7":"12px","fs-8":"14px","fs-9":"15px","fs-10":"16px","fs-11":"17px","fs-12":"19px","fs-13":"20px","fs-18":"30px","fs-body":"13px" },
      glow:"0 1px 0 rgba(0,0,0,.6)", accentSoft:"rgba(232,58,58,.12)", accentLine:"rgba(232,58,58,.45)",
      colors:{ "bg-0":"#0c0d10","bg-1":"#131519","panel":"#191c21","panel-2":"#131519","line":"#2c3138",
               "cyan":"#ff7575","green":"#4ec97a","amber":"#f0c93a","red":"#ff5a5a","magenta":"#6fa8e0",
               "text":"#eef1f4","muted":"#9fa7b1" },
      sheet:"DRIVER CARD", sheetTitle:"Your Driver",
      words:{ tier:"CLASS", loadout:"SETUP", quest:"STINT", journal:"FUEL", stat:"TELEMETRY", inventory:"GARAGE",
              build:"Dial In Your Setup", charCreate:"DRIVER PROFILE", hp:"FUEL", playstyle:"DRIVING STYLE",
              meals:"Dial In Your Setup", tierPick:"Choose Your Class" }
    },
    arcade: {
      tiers:["Rookie", "Contender", "Champion", "Boss", "Final Boss"],
      wash:"radial-gradient(ellipse at top, #24074f 0%, #12042a 58%), repeating-linear-gradient(0deg, rgba(255,92,240,0.020) 0px, rgba(255,92,240,0.020) 1px, transparent 1px, transparent 4px)",
      name:"Retro Arcade", icon:"invader",
      blurb:"Bright, loud, and one more credit",
      fonts:{ display:"'Press Start 2P', monospace", body:"'Chakra Petch', 'Trebuchet MS', sans-serif", scale:1, spacing:"1px" },
      sizes:{ "fs-6":"6px", "fs-7":"7px", "fs-8":"8px", "fs-9":"8px", "fs-10":"9px", "fs-11":"10px", "fs-12":"11px", "fs-13":"12px", "fs-18":"14px", "fs-body":"13px" },
      glow:"none", accentSoft:"rgba(0,229,255,.12)", accentLine:"rgba(0,229,255,.50)",
      colors:{ "bg-0":"#12042a","bg-1":"#1b0740","panel":"#250b52","panel-2":"#1e0844","line":"#3d1780",
               "cyan":"#00e5ff","green":"#4dff5a","amber":"#ffd93d","red":"#ff4d6d","magenta":"#ff5cf0",
               "text":"#fdf3ff","muted":"#b69dd7" },
      sheet:"PLAYER CARD", sheetTitle:"Your Player",
      words:{ tier:"STAGE", loadout:"POWER-UPS", quest:"ROUND", journal:"REFUEL", stat:"SCORE", inventory:"ITEM SELECT",
              build:"Pick Your Power-Ups", charCreate:"PLAYER SELECT", hp:"ENERGY", playstyle:"MODE",
              meals:"Pick Your Power-Ups", tierPick:"Select Stage" }
    },
  };

  /* What each world's paper is made of. Themes that share a material still
     set their own ink and stock colours, so parchment and a water-stained
     horror page are the same construction in different hands. */
  const THEME_MATERIAL = {
    cyberpunk:'digital', arcade:'pixel',  craft:'pixel',   fantasy:'paper',
    horror:'paper',      survival:'salvage', fps:'steel',  outdoors:'ledger',
    farm:'cozy',         racing:'race'
  };

  function applyTheme(key){
    const t = THEMES[key] || THEMES.cyberpunk;
    state.theme = key;
    const r = document.documentElement.style;
    Object.entries(t.colors).forEach(([k,v]) => r.setProperty('--' + k, v));
    r.setProperty('--font-display', t.fonts.display);
    r.setProperty('--font-body', t.fonts.body);
    r.setProperty('--display-spacing', t.fonts.spacing);
    r.setProperty('--title-glow', t.glow || 'none');
    r.setProperty('--accent-soft', t.accentSoft || 'rgba(255,255,255,.08)');
    r.setProperty('--accent-line', t.accentLine || 'rgba(255,255,255,.35)');
    r.setProperty('--bg-wash', t.wash || 'none');
    Object.entries(t.sizes || {}).forEach(([k,v]) => r.setProperty('--' + k, v));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.colors['bg-0']);
    document.body.style.backgroundColor = t.colors['bg-0'];
    /* Screens that are meant to read as a physical object — the quest log
       especially — need to know what the genre is made of, not just what
       colour it is. Parchment, a pixel slot grid and a terminal readout are
       different materials, and no palette variable can express that. */
    document.body.setAttribute('data-theme', key);
    document.body.setAttribute('data-material', THEME_MATERIAL[key] || 'digital');
    applyThemeTiers(t);
    applyThemeWords(t);
    /* The tab strip carries genre words too, but it is only re-labelled on
       navigation — so a theme switched from the settings panel would leave
       stale text sitting there until you changed screens. Re-label in place. */
    const cur = document.querySelector('.screen.active');
    if (cur) refreshTabs(cur.id);
  }

  /* Each genre names its own character classes. The calorie bands never
     move — only what you call the person standing in them. */
  function applyThemeTiers(t){
    if (!t.tiers) return;
    TIERS.forEach((tier, i)=>{ if (t.tiers[i]) tier.name = t.tiers[i]; });
    // anything already on screen needs redrawing with the new names
    if (state.assignedTierId && document.getElementById('sheetClass')
        && document.getElementById('sheetClass').innerHTML) renderTiers();
    if (state.selectedTierId && document.getElementById('mealTimeline')
        && document.getElementById('mealTimeline').innerHTML) renderMealTimeline();
  }

  /* Swap the genre vocabulary wherever it appears */
  function applyThemeWords(t){
    document.querySelectorAll('[data-word]').forEach(el=>{
      const key = el.getAttribute('data-word');
      if (t.words[key]) el.textContent = t.words[key];
    });
  }

