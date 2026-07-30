# Urban Flood Exposure: Dakar, Managua and Ulsan

One identical open-satellite method applied to three cities on three continents,
to estimate what share of each city's population lives on flood-prone low-lying land.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21711394.svg)](https://doi.org/10.5281/zenodo.21711394)

**Author:** Gamchan Park · Independent Researcher
**Status:** flood-exposure analysis complete with sensitivity validation
**License:** MIT (code) · CC BY 4.0 (figures and text)

---

## Why these cities

Dakar and Managua are where I lived as a child, and I watched the same rainfall
produce completely different outcomes street by street. Ulsan is a high-income
reference case. Using open satellite data means the same procedure runs identically
everywhere, so the comparison is not confounded by differing national statistics.

## Results

| City | Population in AOI | On flood-prone land | Share |
|---|---:|---:|---:|
| **Dakar** (Senegal) | 3,409,714 | 881,946 | **25.9 %** |
| **Ulsan** (Rep. of Korea) | 1,156,973 | 78,093 | **6.7 %** |
| **Managua** (Nicaragua) | 1,545,090 | 9,500 | **0.6 %** |

Baseline: 5 m low-lying threshold, 5 degree slope, 20 km radius, GHS-POP 2020.
Total populations agree closely with independently known city populations,
which is the external check on the summation procedure.

## What these numbers can and cannot support

The analysis was re-run under five configurations
(threshold 3 / 5 / 8 m, radius 10 / 20 / 30 km).

| Configuration | Dakar | Ulsan | Managua | Rank | Spearman rho |
|---|---:|---:|---:|---|---:|
| Baseline 5 m, 20 km | 25.87 | 6.75 | 0.615 | D > U > M | 1.000 |
| Threshold 3 m | 7.43 | 1.97 | 0.053 | D > U > M | 1.000 |
| Threshold 8 m | 52.12 | 20.21 | 3.73 | D > U > M | 1.000 |
| Radius 10 km | 22.35 | 8.98 | 0.141 | D > U > M | 1.000 |
| Radius 30 km | 25.60 | 5.88 | 0.539 | D > U > M | 1.000 |

Absolute values vary by up to a factor of 7 (Dakar), 10 (Ulsan) and 70 (Managua).
**The rank order never changes, and Dakar stays at least 2.5x Ulsan in every run.**

> What this method supports: varying the low-lying threshold from 3 to 8 m and the
> analysis radius from 10 to 30 km does not change the rank order of the three
> cities, and Dakar's flood-exposed population share is at least 2.5 times Ulsan's.
> It supports the comparison, not the value.

## The Managua result is a finding about the method, not the city

0.6 % is not evidence that Managua is safe. This method detects land that is
**low and flat**. Managua floods because runoff concentrates down volcanic slopes
into a lakeside basin — a conveyance problem, not a ponding problem — and steep
terrain can never satisfy a low-and-flat criterion. The method is not imprecise
here; it is **blind to the mechanism**.

Any comparative application of a terrain-proximity criterion should state which
flood mechanism it can detect before reporting cross-city rankings.

Identifying that blind spot, rather than the exposure figures themselves, is the
principal contribution of this work. I would not have caught it if I had not
lived in the city.

## Two errors found and corrected on the first run

1. **Negative no-data summed as population.** The population product encodes
   no-data over water as a negative value. Unmasked, Ulsan returned a total of
   −17,217,104.
2. **Resolution mismatch.** A 100 m population count grid summed at 30 m assigns
   the full cell count to every sub-pixel, inflating totals
