"use strict";

// i hate js

/**
 * @typedef cat_t
 * @property {string[]} name
 * @property {string[]} desc

 * @property {number[]} growth
 * @property {number} max_level

 * @property {number} rarity
 * @property {any} stat
 */

/**
 * @typedef event_t
 * @property {number} id
 * @property {string} name
 * @property {boolean} step_up

  // it is either a string or a date
  // wahahhahah
 * @property {string} end_on
 * @property {string} start_on

 * @property {number} rare
 * @property {number} supa
 * @property {number} uber

 * @property {string} version
 */

/**
 * @typedef gacha_t
 * @property {number[]} cats
 * @property {string} name
 * @property {string|null} rate

 * @property {number} series_id
 * @property {number} similarity
 */

/**
 * @typedef data_t
 * @property {cat_t[]} cats
 * @property {Record<string, event_t>} events
 * @property {gacha_t[]} gacha
 */

/**
 * @typedef kitty_t
 * @property {number} idx
 * @property {string} name
 */

/**
 * @typedef pool_t
 * @property {kitty_t[]} rare
 * @property {kitty_t[]} supa
 * @property {kitty_t[]} uber
 * @property {kitty_t[]} legend
 */

/**
 * @typedef banner_t
 * @property {string} name
 * @property {pool_t} pools

 * @property {number} rare_chance
 * @property {number} supa_chance
 * @property {number} uber_chance
 */

/**
 * @typedef parser_msg_t
 * @property {boolean} ok
 * @property {banner_t[]|string} data
 */

importScripts("https://cdn.jsdelivr.net/npm/js-yaml@5.4.2/dist/browser/js-yaml.umd.min.js");

// no one would actually backtrack that far
// right...?
const BANNER_LIMIT = 20;

/** @type {string[]} */
const REGIONS = Object.freeze([
  "https://gitlab.com/api/v4/projects/9827349/repository/files/build%2Fbc-en.yaml/raw?ref=HEAD",
  "https://gitlab.com/api/v4/projects/9827349/repository/files/build%2Fbc-tw.yaml/raw?ref=HEAD",
  "https://gitlab.com/api/v4/projects/9827349/repository/files/build%2Fbc-jp.yaml/raw?ref=HEAD",
  "https://gitlab.com/api/v4/projects/9827349/repository/files/build%2Fbc-kr.yaml/raw?ref=HEAD",
]);

/** @type {string[]} */
const RARITIES = [ "normal", "special", "rare", "supa", "uber", "legend" ];

// i spent more time finding the data (and a crashout too)
// than i would like to admit
/**
 * @async
 * @param {string} url
 * @returns {Promise<data_t>}
 */
async function fetch_data(url)
{
  const body = await fetch(url);

  if (!body.ok)
  {
    throw new Error(`http err: ${body.status}`);
  }

  return jsyaml.load(await body.text());
}

/**
 * @function
 * @param {data_t} data
 * @returns {banner_t[]}
 */
function parse_banners(data)
{
  if (!data || !data.cats || !data.events || !data.gacha) {
    throw new Error(`invalid data struct: ${data}`);
  }

  /** @type {Map<number, pool_t>} */
  const multi_pools = new Map();

  /** @type {banner_t[]} */
  let banners = [];

  for (const val of Object.values(data.events).reverse())
  {
    if (banners.length == BANNER_LIMIT)
    {
      break;
    }

    const id = val.id;
    let pools = multi_pools.get(id);

    if (pools == undefined)
    {
      const entry = data.gacha[id];
      const kitties = entry.cats;

      if (!entry || !kitties)
      {
        throw new Error(`invalid gacha struct: ${entry}`)
      }

      /** @type {pool_t} */
      const new_pools = { rare: [], supa: [], uber: [], legend: [] };

      for (const kitty_id of Object.values(kitties))
      {
        const kitty = data.cats[kitty_id];

        /** @type {kitty_t[]} */
        const new_pool = new_pools[RARITIES[kitty.rarity]];

        new_pool.push({ idx: new_pool.length, name: kitty.name[0] });
      }

      // i don't like this
      new_pools.rare.sort((a, b) => a.name.localeCompare(b.name));
      new_pools.supa.sort((a, b) => a.name.localeCompare(b.name));
      new_pools.uber.sort((a, b) => a.name.localeCompare(b.name));
      new_pools.legend.sort((a, b) => a.name.localeCompare(b.name));

      pools = new_pools;
      multi_pools.set(id, pools);
    }

    banners.push({
      name: `${val.start_on.slice(0, 10)} ~ ${val.end_on.slice(0, 10)}: ${val.name}`,
      pools: pools,

      rare_chance: val.rare,
      supa_chance: val.supa,
      uber_chance: val.uber,
    });
  }

  return banners;
}

/**
 * @function
 * @returns {void}
 */
function main()
{
  self.onmessage = async function(ev)
  {
    /** @type {number} */
    const region = ev.data;

    try
    {
      const data = await fetch_data(REGIONS[region]);
      self.postMessage({ ok: true, data: parse_banners(data) });
    }
    catch (err)
    {
      self.postMessage({ ok: false, data: err.message });
    }
  }
}

main();
