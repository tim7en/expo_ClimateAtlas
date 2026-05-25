window.ATLAS_OVERVIEW = {
  riverCount: 2,
  seaCount: 1
};

window.ATLAS_GLOSSARY = [
  { term: "daryo", definition: "river" },
  { term: "suv ombori", definition: "reservoir" },
  { term: "kanal", definition: "canal" },
  { term: "cho'l", definition: "desert" },
  { term: "tog'", definition: "mountain" },
  { term: "vodiy", definition: "valley" }
];

window.REGIONS = [
  {
    id: "karakalpakstan",
    name: "Republic of Karakalpakstan",
    uz: "Qoraqalpog'iston Respublikasi",
    type: "Climate and water plate",
    scale: "1 : 900 000",
    caption: "Aral retreat, Amu Darya delta channels, and restoration landscapes.",
    map: "assets/maps/01-karakalpakstan.jpg",
    palette: ["#c16239", "#2d7068", "#d3b064"],
    summary:
      "Karakalpakstan frames Uzbekistan's starkest water story. The lower Amu Darya splays into a fragile delta, while the exposed bed of the Aral Sea drives salt-and-dust storms, wetland loss, and new restoration efforts across the northwestern frontier.",
    themes: ["Aral Sea", "Delta restoration", "Dust storms", "Wetlands"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Delta lowlands, exposed seabed, desert plateau, and sparse wetlands."
      },
      {
        key: "water",
        label: "Water",
        value: "The lower Amu Darya and its delta distributaries define every settled corridor."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Highly continental and wind-exposed, with extreme summer aridity and saline dust."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Track how a vanishing sea turns a water map into a resilience map."
      }
    ]
  },
  {
    id: "andijan",
    name: "Andijan Region",
    uz: "Andijon viloyati",
    type: "Climate and water plate",
    scale: "1 : 250 000",
    caption: "Kara Darya storage, dense settlement, and intense irrigated cultivation.",
    map: "assets/maps/02-andijan.jpg",
    palette: ["#cb6a39", "#3b8772", "#e3bf77"],
    summary:
      "Andijan sits at the eastern end of the Fergana Valley, where cultivated land, industry, and settlement are compressed into a small basin. The Kara Darya and Andijan reservoir anchor the region's irrigation system, but the same density that makes the valley productive also amplifies heat and water competition.",
    themes: ["Kara Darya", "Reservoir storage", "Irrigation", "Dense settlement"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "A compact valley basin ringed by mountain slopes and transport corridors."
      },
      {
        key: "water",
        label: "Water",
        value: "The Kara Darya, Andijan reservoir, and a dense canal web feed the fields."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "A sheltered continental valley climate with hot summers and cold winter inversions."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Show what maximum agricultural intensity looks like under constrained water supply."
      }
    ]
  },
  {
    id: "bukhara",
    name: "Bukhara Region",
    uz: "Buxoro viloyati",
    type: "Climate and water plate",
    scale: "1 : 500 000",
    caption: "Oasis hydrology, desert heat, and lower Zarafshan dependency.",
    map: "assets/maps/03-bukhara.jpg",
    palette: ["#cc8442", "#2a746e", "#e1c07d"],
    summary:
      "Bukhara is an oasis region suspended inside desert. Its settlements and farms rely on the lower Zarafshan system, canal diversions, and shallow groundwater, making the plate ideal for reading the tension between historic oasis continuity and modern water stress in a very dry climate.",
    themes: ["Oasis", "Zarafshan", "Desert heat", "Groundwater"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Oasis islands spread across low desert plains and wind-shaped sandy tracts."
      },
      {
        key: "water",
        label: "Water",
        value: "The lower Zarafshan, irrigation canals, and groundwater keep the oasis alive."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Very hot, arid summers with high evaporation and limited local runoff."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Use the map to explain how oasis systems survive at the edge of water scarcity."
      }
    ]
  },
  {
    id: "fergana",
    name: "Fergana Region",
    uz: "Farg'ona viloyati",
    type: "Climate and water plate",
    scale: "1 : 250 000",
    caption: "Enclosed valley climates, mountain runoff, and irrigated patchworks.",
    map: "assets/maps/04-fergana.jpg",
    palette: ["#c45f40", "#34806f", "#dae08f"],
    summary:
      "Fergana occupies the southern rim of the enclosed Fergana Valley, where irrigated plains abruptly meet the Alay foothills. Meltwater from surrounding mountain systems feeds the valley floor, making this plate a clear demonstration of how distant snow and local heat are tied together inside a closed agricultural basin.",
    themes: ["Valley climate", "Mountain runoff", "Irrigation", "Closed basin"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Flat irrigated plains rising quickly into foothills and mountain fronts."
      },
      {
        key: "water",
        label: "Water",
        value: "Tributaries from surrounding ranges feed canals and fields across the valley floor."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "A warm continental valley regime shaped by winter inversions and summer heat."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Read the plate as a closed climate-and-water bowl fed from its own mountain rim."
      }
    ]
  },
  {
    id: "jizzakh",
    name: "Jizzakh Region",
    uz: "Jizzax viloyati",
    type: "Climate and water plate",
    scale: "1 : 450 000",
    caption: "Hungry Steppe margins, reservoir chains, and east-to-west moisture decline.",
    map: "assets/maps/05-jizzakh.jpg",
    palette: ["#cb733a", "#5b8757", "#ddb76a"],
    summary:
      "Jizzakh bridges mountain-fed eastern landscapes and drier western steppe. Reservoirs and the Aydar-Arnasay lake system make the plate especially useful for discussing redistributed water, irrigation expansion, and the way climate conditions shift rapidly across short regional distances.",
    themes: ["Aydar-Arnasay", "Reservoirs", "Steppe", "Irrigation expansion"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Foothills and uplands in the east opening onto broad steppe and basin lands."
      },
      {
        key: "water",
        label: "Water",
        value: "Reservoir chains, managed canals, and the Aydar-Arnasay water system shape land use."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Drier westward gradients, hot summers, and strong year-to-year rainfall variability."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Use it to show how infrastructure can redistribute water across a semi-arid steppe."
      }
    ]
  },
  {
    id: "namangan",
    name: "Namangan Region",
    uz: "Namangan viloyati",
    type: "Climate and water plate",
    scale: "1 : 250 000",
    caption: "Northern Fergana tributaries, foothill hazards, and irrigated orchards.",
    map: "assets/maps/06-namangan.jpg",
    palette: ["#c86135", "#2f8b76", "#e1bb70"],
    summary:
      "Namangan lies between the densely farmed Fergana Valley floor and steep ranges to the north. Mountain-fed tributaries recharge canals and orchards, but the same relief also concentrates flash-flood risk, erosion, and strong local contrasts between cooler foothills and warmer lowland farms.",
    themes: ["Tributaries", "Foothills", "Flood risk", "Orchards"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Foothills and valleys dropping toward one of Central Asia's most settled plains."
      },
      {
        key: "water",
        label: "Water",
        value: "Mountain-fed streams and canals link high catchments to intensive valley agriculture."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Continental with sharp local gradients between foothill relief and warm lowlands."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "A strong plate for connecting flashier mountain hydrology to steady irrigation demand."
      }
    ]
  },
  {
    id: "navoiy",
    name: "Navoiy Region",
    uz: "Navoiy viloyati",
    type: "Climate and water plate",
    scale: "1 : 700 000",
    caption: "Desert scale, lower Zarafshan threads, and mining-era water demand.",
    map: "assets/maps/07-navoiy.jpg",
    palette: ["#cb7f3e", "#2f7082", "#e2cf86"],
    summary:
      "Navoiy is a plate about scale. Long dry distances, extractive industry, and sparse settlement make every river reach, canal branch, and reservoir edge legible. It is the place to show how scarce water is stretched across the Kyzylkum and how industrial corridors rely on thin hydrological lines.",
    themes: ["Kyzylkum", "Mining", "Sparse hydrology", "Industrial demand"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "A vast desert interior punctuated by mining districts and transport corridors."
      },
      {
        key: "water",
        label: "Water",
        value: "The lower Zarafshan and managed reservoirs are sparse but strategically critical."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Hyper-arid lowland conditions with severe summer heat and very low rainfall."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Show how little water is available relative to the spatial scale of demand."
      }
    ]
  },
  {
    id: "qashqadaryo",
    name: "Qashqadaryo Region",
    uz: "Qashqadaryo viloyati",
    type: "Climate and water plate",
    scale: "1 : 450 000",
    caption: "Hisar headwaters, Qarshi plain irrigation, and drought-sensitive runoff.",
    map: "assets/maps/08-qashqadaryo.jpg",
    palette: ["#b85c32", "#5a8b4d", "#dfbb73"],
    summary:
      "Qashqadaryo runs from the Hisar mountains down into the Qarshi steppe, letting one plate hold very different climate zones together. Mountain runoff, storage, irrigation demand, and energy development all compete for attention here, making it a clear case study in how upstream snow and downstream drought are connected.",
    themes: ["Hisar", "Qarshi steppe", "Irrigation", "Drought"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "High eastern relief descending toward open plains and irrigated agricultural belts."
      },
      {
        key: "water",
        label: "Water",
        value: "The Qashqadaryo system depends on mountain runoff and storage before fading westward."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Cooler uplands contrast with very hot, dry lowlands vulnerable to drought stress."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Read it as a full headwaters-to-steppe story inside a single regional plate."
      }
    ]
  },
  {
    id: "samarqand",
    name: "Samarqand Region",
    uz: "Samarqand viloyati",
    type: "Climate and water plate",
    scale: "1 : 350 000",
    caption: "Zarafshan basin agriculture, plateau valleys, and heritage under water pressure.",
    map: "assets/maps/09-samarqand.jpg",
    palette: ["#cb6f3c", "#2e7b83", "#ddb76f"],
    summary:
      "Samarqand is centered on the Zarafshan basin, where a productive agricultural heartland surrounds one of Central Asia's best-known cities. Springs, canals, and river-fed cultivation make the plate readable as both a heritage landscape and a basin-level water system under growing climatic and demographic pressure.",
    themes: ["Zarafshan", "Heritage landscape", "Canals", "Agriculture"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Cultivated valleys and plateaus structured by the Zarafshan corridor."
      },
      {
        key: "water",
        label: "Water",
        value: "The Zarafshan river, springs, and canal networks sustain orchards and settlements."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "A continental interior climate with hot summers and rising irrigation demand."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Ideal for showing how cultural landscapes are also managed hydrological landscapes."
      }
    ]
  },
  {
    id: "sirdaryo",
    name: "Sirdaryo Region",
    uz: "Sirdaryo viloyati",
    type: "Climate and water plate",
    scale: "1 : 250 000",
    caption: "Hungry Steppe irrigation geometry and single-river dependency.",
    map: "assets/maps/10-sirdaryo.jpg",
    palette: ["#c96d3f", "#338371", "#dccc80"],
    summary:
      "Sirdaryo is one of the clearest water-management plates in the atlas. It occupies a low, compact part of the Hungry Steppe where the Syr Darya and major irrigation structures dominate land use, making salinity, drainage, and single-river dependency visible almost at a glance.",
    themes: ["Syr Darya", "Hungry Steppe", "Salinity", "Drainage"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Flat, low-lying plains cultivated almost continuously from edge to edge."
      },
      {
        key: "water",
        label: "Water",
        value: "The Syr Darya and irrigation channels are the backbone of every agricultural zone."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Dry continental conditions with strong evaporation and exposed winter winds."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "A concise study in what near-total dependence on one river looks like on the ground."
      }
    ]
  },
  {
    id: "surxondaryo",
    name: "Surxondaryo Region",
    uz: "Surxondaryo viloyati",
    type: "Climate and water plate",
    scale: "1 : 600 000",
    caption: "Warm southern valleys, Amu Darya frontage, and mountain-fed extremes.",
    map: "assets/maps/11-surxondaryo.jpg",
    palette: ["#d87535", "#45815f", "#e3bd73"],
    summary:
      "Surxondaryo is Uzbekistan's hottest regional plate. Sheltered valleys, mountain headwaters, and Amu Darya border reaches combine to produce long hot growing seasons and strong contrasts between irrigated corridors and surrounding dry slopes, making it an effective climate-extremes chapter inside the atlas.",
    themes: ["Amu Darya", "Heat extremes", "Mountain runoff", "Border valleys"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "A warm southern basin opening toward the Amu Darya beneath high mountain walls."
      },
      {
        key: "water",
        label: "Water",
        value: "The Surxondaryo river, tributary catchments, and the Amu Darya border flow."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "The country's warmest climate, with intense summer heat and long growing seasons."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Use the plate to discuss how a hotter future may expand southward climate pressures."
      }
    ]
  },
  {
    id: "tashkent-region",
    name: "Tashkent Region",
    uz: "Toshkent viloyati",
    type: "Climate and water plate",
    scale: "1 : 500 000",
    caption: "Mountain snowpack, Charvak storage, and metropolitan water supply.",
    map: "assets/maps/12-tashkent-region.jpg",
    palette: ["#d56839", "#2b728d", "#d7e393"],
    summary:
      "Tashkent region links the western Tien Shan foothills to the country's largest metropolitan concentration. Snowpack, reservoirs, hydropower, foothill hazard zones, and dense water demand all appear together here, so the plate works as a bridge between mountain climate processes and lowland urban consumption.",
    themes: ["Charvak", "Snowpack", "Hydropower", "Metropolitan supply"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "Plains and industrial belts rising sharply into reservoir valleys and mountain slopes."
      },
      {
        key: "water",
        label: "Water",
        value: "The Chirchiq system and Charvak reservoir store and deliver water to the capital region."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Cooler, wetter highlands contrast with warmer and drier lowland districts."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "A strong plate for showing mountain snow acting as a water bank for cities below."
      }
    ]
  },
  {
    id: "tashkent-city",
    name: "Tashkent City",
    uz: "Toshkent shahri",
    type: "Urban climate plate",
    scale: "1 : 100 000",
    caption: "Urban heat, canal-fed green structure, and metropolitan water demand.",
    map: "assets/maps/13-tashkent-city.jpg",
    palette: ["#ea964b", "#327f9f", "#f0d8a2"],
    summary:
      "Tashkent City deserves its own plate because the climate story shifts from regional basins to urban surfaces. Canal-fed greenery, parks, dense transport networks, and heat-absorbing built fabric create a compact map for discussing urban heat, stormwater, and how water softens life inside the capital.",
    themes: ["Urban heat island", "Canals", "Green infrastructure", "Stormwater"],
    facts: [
      {
        key: "terrain",
        label: "Urban fabric",
        value: "A compact metropolitan core with major boulevards, parks, and engineered waterways."
      },
      {
        key: "water",
        label: "Water",
        value: "Canals and managed green-space irrigation help cool and structure the city."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Urban heat island effects intensify summer discomfort and peak water demand."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "Show climate not just as weather, but as a condition shaped by city form and water."
      }
    ]
  },
  {
    id: "xorazm",
    name: "Xorazm Region",
    uz: "Xorazm viloyati",
    type: "Climate and water plate",
    scale: "1 : 250 000",
    caption: "Lower Amu Darya irrigation geometry and oasis-desert contrast.",
    map: "assets/maps/14-xorazm.jpg",
    palette: ["#d27d35", "#2d8a78", "#e5da8f"],
    summary:
      "Xorazm closes the atlas with one of its most legible water landscapes. Irrigation geometry, drainage lines, and oasis settlement stand out sharply against surrounding aridity, making the region an ideal final chapter on how engineered water networks support life on the lower Amu Darya.",
    themes: ["Lower Amu Darya", "Oasis geometry", "Drainage", "Salinity"],
    facts: [
      {
        key: "terrain",
        label: "Terrain",
        value: "A low oasis plain bounded by desert margins and engineered field geometry."
      },
      {
        key: "water",
        label: "Water",
        value: "The lower Amu Darya and dense irrigation-drainage grids shape every settlement belt."
      },
      {
        key: "climate",
        label: "Climate signal",
        value: "Hot, dry summers with salinity and drainage pressure across cultivated land."
      },
      {
        key: "focus",
        label: "Atlas lens",
        value: "A final plate for reading water as visible geometry rather than hidden infrastructure."
      }
    ]
  }
];

// Add future atlas collections here. The app will surface each entry in the atlas selector.
window.ATLASES = [
  {
    id: "climate-water",
    name: "Climate and Water",
    overview: {
      riverCount: window.ATLAS_OVERVIEW.riverCount,
      seaCount: window.ATLAS_OVERVIEW.seaCount,
      plateLabel: "Plates",
      riverLabel: "Great Rivers",
      seaLabel: "Vanishing Sea"
    },
    glossary: window.ATLAS_GLOSSARY,
    regions: window.REGIONS
  }
];
