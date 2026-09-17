"use strict";

/**
 * @typedef kitty_t
 * @property {number} idx
 * @property {number} rarity
 */

/**
 * @typedef args_t
 * @property {kitty_t[]} kitties

 * @property {number} rare_amount
 * @property {number} supa_amount
 * @property {number} uber_amount
 * @property {number} legend_amount

 * @property {number} rare_chance
 * @property {number} supa_chance
 * @property {number} uber_chance
*/

/**
 * @typedef res_t
 * @property {number} begin
 * @property {number} end
 * @property {number} count
 * @property {number} run
 */

/**
 * @typedef seeker_msg_t
 * @property {boolean} ok
 * @property {res_t|string} data
 */

async function main()
{
  /** @type {WebAssembly.WebAssemblyInstantiatedSource} */
  let seeker = null;

  try
  {
    seeker = await WebAssembly.instantiateStreaming(fetch("../seeker.wasm"));
  }
  catch (err)
  {
    self.postMessage({ ok: false, data: `Failed to init seeker: ${err}` });
    return;
  }

  const exports = seeker.instance.exports;

  self.onmessage = function(ev)
  {
    /** @type {args_t} */
    const args = ev.data;

    /** @type {number[]} */
    let seeker_args = [
      args.rare_chance, args.supa_chance, args.uber_chance,
      args.rare_amount, args.supa_amount, args.uber_amount, args.legend_amount,
      args.kitties.length,
    ];

    for (let idx = 0; idx < 10; idx++)
    {
      const kitty = args.kitties[idx];

      if (!kitty)
      {
        seeker_args.push(0);
        seeker_args.push(0);

        continue;
      }

      seeker_args.push(kitty.idx);
      seeker_args.push(kitty.rarity);
    }

    // i am so pissed
    // i spent so much time debugging
    // just to find out that i forgot to call this
    exports.seek_seed(...seeker_args);

    // forces js to treat the seeds as uint32
    self.postMessage({ ok: true, data: {
      begin: exports.get_seed_begin() >>> 0,
      end: exports.get_seed_end() >>> 0,
      count: exports.get_found_seeds(),
      run: exports.get_run(),
    } })
  }
}

main();
