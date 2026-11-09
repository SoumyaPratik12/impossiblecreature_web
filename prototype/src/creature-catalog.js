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
  function compose(bodyKey, headKey) {
    const body = bodies[bodyKey] || bodies.wolf;
    const head = heads[headKey] || heads.wolf;
    return { body: bodyKey in bodies ? bodyKey : "wolf", head: headKey in heads ? headKey : "wolf",
      name: body.label + " body / " + head.label + " head", maxHp: Math.max(50, body.health + head.health),
      speed: Math.max(35, body.speed + head.speed), attack: Math.max(4, body.attack + head.attack),
      defense: Math.max(0, body.defense + head.defense), radius: body.radius };
  }
  window.CreatureCatalog = { bodies, heads, compose };
})();
