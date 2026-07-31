# Pre-registration — falsification test of the steep-terrain blind spot

**Recorded:** 2026-07-31, before the analysis was run
**Author:** Gamchan Park
**Script:** `gee/03_falsification.js`
**Repository:** https://github.com/gamchanpark/urban-flood-exposure
**Archived version of the parent study:** DOI 10.5281/zenodo.21711394

---

## 1. The claim being tested

In the three-city run, Managua returned a flood-exposed population fraction of
**0.6 %**, against **25.9 %** for Dakar. Managua floods every wet season, so a
near-zero result demands an explanation.

The explanation given in the report is:

> Managua drains steep volcanic slopes into a lakeside basin. Its flooding is
> driven by conveyance — water moving fast through streets and channels — while
> this method recognises only land that is both **low** and **flat**. A criterion
> requiring HALM < 5 m *and* slope < 5° cannot represent conveyance-driven
> flooding by construction.

That explanation was formed **after** seeing the number. On its own it is
indistinguishable from an excuse. This document exists so that the test of it is
not.

## 2. Design

Apply the **identical, unmodified** procedure of `01_flood_exposure.js` v1.1 to
eight cities in three groups.

| Group | Cities | Why these |
|---|---|---|
| **steep** | Managua, Tegucigalpa, Medellín, Freetown | All four flood recurrently; all four sit on high-relief terrain |
| **flat** | Dakar, Dhaka, Jakarta | All three flood recurrently; all three are low-relief deltaic or coastal plains |
| **ref** | Ulsan | Carried over from the main run as the reference case |

The **independent variable** is terrain steepness, measured as
`steep_area_frac` — the fraction of land inside the 20 km radius with slope
above 10°. This threshold (10°) is used **only to describe terrain**. It never
enters the flood-prone classification, which uses 5°. The two are deliberately
different so that the correlation in P3 is not circular.

The **dependent variable** is `pop_exposed_frac`, unchanged from the main run.

## 3. Predictions

| # | Prediction |
|---|---|
| **P1** | Every **steep** city returns `pop_exposed_frac` **< 5 %** |
| **P2** | Every **flat** city returns `pop_exposed_frac` **> 15 %** |
| **P3** | Across all eight cities, the Spearman rank correlation between `steep_area_frac` and `pop_exposed_frac` is **negative and stronger than −0.7** |

## 4. What would falsify it

| # | Falsifying outcome | What I would then conclude |
|---|---|---|
| **F1** | Any **steep** city returns **> 15 %** | Steepness alone does not suppress the metric. The Managua result needs a different explanation, most likely something specific to Managua that I got wrong. The report paragraph would be rewritten, not defended. |
| **F2** | Any **flat** city returns **< 5 %** | The metric is not tracking low flat land at all, and the entire cross-city comparison is unsafe. |
| **F3** | Rank correlation weaker than −0.7, or positive | The proposed mechanism does not organise the results and should be withdrawn. |

An outcome between the thresholds (e.g. a steep city at 8 %) is **not** a pass.
It would be reported as an ambiguous result, not rounded toward the prediction.

## 5. What a pass would and would not license

**Would license:** the statement that this method systematically under-reports
flood exposure in high-relief cities, and that the Managua value is a property of
the method rather than of Managua.

**Would not license:** any claim that Managua is safe, that the method measures
flood *risk*, or that the three-city ranking is a risk ranking. It remains a
ranking of exposure to one specific mechanism — low, flat, non-water land — and
nothing else.

**Sample size.** Eight cities is not a sample. No inferential statistic is
claimed beyond the rank correlation, which is reported as a description of these
eight and not generalised.

## 6. Analysis plan

Fixed in advance:

1. Export the CSV from `gee/03_falsification.js`.
2. Run `analysis/falsification.py`, which computes the Spearman rank correlation
   and produces one scatter plot of `steep_area_frac` against
   `pop_exposed_frac`, with the P1/P2 thresholds drawn as lines.
3. Record the outcome in `docs/FALSIFICATION_RESULT.md` **whether it passes or
   fails**, with the raw CSV committed alongside it.

No city will be added, dropped or re-centred after seeing results. If a city
fails to compute for a technical reason (missing coverage, export error), that
is recorded as missing rather than replaced.
