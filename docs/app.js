"use strict";

// js sucks
// also strict doesn't seem to do anything?

/**
 * @typedef stored_banners_t
 * @property {banner_t[]} banners
 * @property {number} expired_at
 */

/**
 * @typedef opt_t
 * @property {string} name
 * @property {string} idx
 */

const STORED_BANNERS_LIFETIME = 1_800_000;
const UPCOMING_BANNER_AMOUNT = 9;

const banner_fetcher = new Worker("./workers/banner_fetcher.js");
const seed_seeker = new Worker("./workers/seed_seeker.js", { type: "module" });

// honestly no idea what this does
// kinda used gemini too
/**
 * @function
 * @param {number} region
 * @returns {Promise<banner_t[]>}
 */
function fetch_banners(region)
{
  return new Promise((resolve, reject) => {
    banner_fetcher.addEventListener("message", (ev) => {
      /** @type {parser_msg_t} */
      const msg = ev.data;

      if (msg.ok)
      {
        resolve(msg.data);
      }
      else
      {
        reject(new Error(msg.data));
      }
    }, { once: true });

    banner_fetcher.addEventListener("error", (err) => {
      reject(err);
    }, { once: true });

    banner_fetcher.postMessage(region)
  });
}

/**
 * @async
 * @param {number} region
 * @returns {Promise<banner_t[]>}
 */
async function get_banners(region)
{
  const region_str = String(region);
  const stored_banners_str = localStorage.getItem(region_str);

  if (stored_banners_str != null)
  {
    /** @type {stored_banners_t} */
    const stored_banners = JSON.parse(stored_banners_str);

    if (stored_banners.expired_at >= Date.now())
    {
      return stored_banners.banners;
    }

    localStorage.removeItem(region_str);
  }

  const new_banners = await fetch_banners(region);

  /** @type {stored_banners_t} */
  const new_stored_banners = {
    banners: new_banners,
    expired_at: Date.now() + STORED_BANNERS_LIFETIME,
  };

  localStorage.setItem(region_str, JSON.stringify(new_stored_banners));
  return new_banners;
}

/**
 * @async
 * @returns {Promise<void>}
 */
function main()
{
  /** @type {banner_t[]} */
  let banners = [];

  /** @type {banner_t|null} */
  let curr_banner = null;

  const status_txt = document.getElementById("status_txt");
  const region_sel = document.getElementById("region_sel");
  const banner_sel = document.getElementById("banner_sel");

  const banner_upcoming = document.getElementById("banner_upcoming");
  const banner_past = document.getElementById("banner_past");

  const kitty_sels = document.getElementsByClassName("kitty_sel");

  const seek_btn = document.getElementById("seek");
  const res_label = document.getElementById("res");

  region_sel.addEventListener("change", async (ev) => {
    region_sel.disabled = true;
    status_txt.textContent = "Fetching data...";

    try
    {
      banners = await get_banners(parseInt(ev.target.value));

      /** @type {HTMLOptionElement[]} */
      let upcoming_opts = [];

      /** @type {HTMLOptionElement} */
      let past_opts = [];

      for (const [idx, val] of Object.entries(banners))
      {
        if (Number(idx) > UPCOMING_BANNER_AMOUNT)
        {
          upcoming_opts.push(new Option(val.name, idx));
          continue;
        }

        past_opts.push(new Option(val.name, idx));
      }

      banner_sel.value = "";

      banner_upcoming.replaceChildren(...upcoming_opts);
      banner_past.replaceChildren(...past_opts);

      status_txt.textContent = "Awaiting...";
    }
    catch (err)
    {
      status_txt.textContent = `Failed to load banners: ${err}`;
    }
    finally
    {
      region_sel.disabled = false;
    }
  });

  // it is prolly unnecessary for this to have a lock
  // but mweh
  banner_sel.addEventListener("change", (ev) => {
    banner_sel.disabled = true;
    status_txt.textContent = "Parsing data...";

    curr_banner = banners[parseInt(ev.target.value)];
    const pools = curr_banner.pools;

    /** @type {HTMLOptionElement[]} */
    let rare_opts = [];

    /** @type {HTMLOptionElement[]} */
    let supa_opts = [];

    /** @type {HTMLOptionElement[]} */
    let uber_opts = [];

    /** @type {HTMLOptionElement[]} */
    let legend_opts = [];

    // in the seeker, rare is 0, and so on
    // but in the data, rare is 2 and so on
    for (const val of pools.rare.values()) { rare_opts.push(new Option(`${val.name} (${val.idx})`, `${val.idx}_0`)) }
    for (const val of pools.supa.values()) { supa_opts.push(new Option(`${val.name} (${val.idx})`, `${val.idx}_1`)) }
    for (const val of pools.uber.values()) { uber_opts.push(new Option(`${val.name} (${val.idx})`, `${val.idx}_2`)) }
    for (const val of pools.legend.values()) { legend_opts.push(new Option(`${val.name} (${val.idx})`, `${val.idx}_3`)) }

    for (let idx = 0; idx < kitty_sels.length; idx++)
    {
      /** @type {HTMLOptionElement[]} */
      let cloned_rare_opts = [];

      /** @type {HTMLOptionElement[]} */
      let cloned_supa_opts = [];

      /** @type {HTMLOptionElement[]} */
      let cloned_uber_opts = [];

      /** @type {HTMLOptionElement[]} */
      let cloned_legend_opts = [];

      for (const opt of rare_opts.values()) { cloned_rare_opts.push(opt.cloneNode(true)) }
      for (const opt of supa_opts.values()) { cloned_supa_opts.push(opt.cloneNode(true)) }
      for (const opt of uber_opts.values()) { cloned_uber_opts.push(opt.cloneNode(true)) }
      for (const opt of legend_opts.values()) { cloned_legend_opts.push(opt.cloneNode(true)) }

      // hmmmmm
      kitty_sels[idx].value = "";

      // micro optimization :>>>>
      const idx_str = String(idx);

      document.getElementById(`kitty_${idx_str}_rare`).replaceChildren(...cloned_rare_opts);
      document.getElementById(`kitty_${idx_str}_supa`).replaceChildren(...cloned_supa_opts);
      document.getElementById(`kitty_${idx_str}_uber`).replaceChildren(...cloned_uber_opts);
      document.getElementById(`kitty_${idx_str}_legend`).replaceChildren(...cloned_legend_opts);
    }

    banner_sel.disabled = false;
    status_txt.textContent = "Awaiting...";
  });

  seek_btn.addEventListener("click", () => {
    if (!curr_banner) { return }

    seek_btn.disabled = true;
    status_txt.textContent = "Seeking seed..."

    const pools = curr_banner.pools;

    /** @type {kitty_t[]} */
    let kitties = [];

    for (let idx = 0; idx < kitty_sels.length; idx++)
    {
      /** @type {string|null} */
      const val = kitty_sels[idx].value
      if (!val) { break }

      const vals = val.split("_");
      kitties.push({ idx: parseInt(vals[0]), rarity: parseInt(vals[1]) });
    }

    /** @type {@import("./workers/seed_seeker").args_t} */
    const args = {
      kitties: kitties,

      rare_amount: pools.rare.length,
      supa_amount: pools.supa.length,
      uber_amount: pools.uber.length,
      legend_amount: pools.legend.length,

      rare_chance: curr_banner.rare_chance,
      supa_chance: curr_banner.supa_chance,
      uber_chance: curr_banner.uber_chance,
    };

    if (args.kitties.length < 1)
    {
      seek_btn.disabled = false;
      status_txt.textContent = "Bad inputs!";

      return;
    }

    seed_seeker.postMessage(args);
  });

  seed_seeker.onmessage = function(ev)
  {
    /** @type {seeker_msg_t} */
    const msg = ev.data;

    if (!msg.ok)
    {
      seek_btn.disabled = false;
      status_txt.textContent = `Failed to seek seed: ${msg.data}`;

      return;
    }

    const data = msg.data;

    if (data.found > 1)
    {
      res_label.insertAdjacentHTML("beforeend", "This might not be your actual seed because there are more than 1 seeds found.<br>");
    }

    const begin_str = String(data.begin);
    const end_str = String(data.end);

    res_label.insertAdjacentHTML("beforeend", `Your starting seed is: <a href="https://bc.godfat.org/?seed=${begin_str}" target="_blank">${begin_str}<a><br>`);
    res_label.insertAdjacentHTML("beforeend", `After rolling the cats you entered, your last seed is: <a href="https://bc.godfat.org/?seed=${end_str}" target="_blank">${end_str}<a><br>`);

    seek_btn.disabled = false;
    status_txt.textContent = "Awaiting...";
  }
}

document.addEventListener("DOMContentLoaded", main);
