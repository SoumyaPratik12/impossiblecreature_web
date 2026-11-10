(() => {
  "use strict";
  const bodies = {
    wolf: { label: "Wolf", health: 100, speed: 108, attack: 12, defense: 2, radius: 15 },
    bear: { label: "Bear", health: 155, speed: 66, attack: 17, defense: 7, radius: 19 },
    eagle: { label: "Eagle", health: 78, speed: 142, attack: 10, defense: 1, radius: 13 }
  };
  const heads = {
    wolf: { label: "Wolf", health: 0, speed: 4, attack: 5, defense: 0 },
    bear: { label: "Bear", health: 18, speed: -8, attack: 8, defense: 3 },
    eagle: { label: "Eagle", health: -8, speed: 14, attack: 3, defense: 0 }
  };
  function compose(bodyKey, headKey, domain="land") {
    const body = bodies[bodyKey] || bodies.wolf;
    const head = heads[headKey] || heads.wolf;
    const movement=domain==="water"?{speed:0.88,health:1.08,attack:1.05,radius:1.08}:domain==="air"?{speed:1.28,health:.82,attack:.92,radius:.88}:{speed:1,health:1,attack:1,radius:1};\n    return { body: bodyKey in bodies ? bodyKey : "wolf", head: headKey in heads ? headKey : "wolf", domain, locomotion:domain,
      name: body.label + " body / " + head.label + " head", maxHp: Math.max(50, body.health + head.health),
      speed: Math.max(35, body.speed + head.speed), attack: Math.max(4, body.attack + head.attack),
      defense: Math.max(0, body.defense + head.defense), radius: body.radius };
  }
  window.CreatureCatalog = { bodies, heads, compose };
})();
