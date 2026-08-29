# Role coverage in the local iGOT catalog

## Answer

The user almost certainly meant **roles**, not rules. The question being answered was how many job-role matrices the prototype should contain, and the follow-up asks how many can be built from the course JSON. There is no rule model in the supplied requirements.

Ten role matrices are feasible. Seven have strong catalog support and three have moderate support. The prototype should not seed separate National Accounts, Price Statistics, Labour Statistics, Agricultural Statistics, or SDG Statistics roles from this file. Their search captures are sparse or misleading.

The best demo role is **Statistical Investigator / Junior Statistical Officer**. It connects the full assessment story to MoSPI work and has detailed evidence for statistics, household survey data, R, Python, data visualization, and data quality. It also avoids pretending that thin specialist search results form a complete learning path.

## How the counts work

The primary source is [`sih.json`](../../sih.json), captured from the authenticated iGOT global course search on 25 August 2026.

Each competency below has a count in `captured/detailed` form:

- `captured` is the number of unique catalog records tagged with that exact `search_terms` value.
- `detailed` is the subset whose course detail page was captured, including description and usually learning outcomes and tags.

These are evidence counts, not claims that every search result is relevant. The source itself says this is a targeted, relevance-ranked capture of 222 unique courses, not a full export of the 5,171-course catalog. Search noise is material. For example, the 10 `national accounts` results are financial-accounting courses rather than national economic accounting courses. The 10 `sampling` results mostly concern environmental, geological, or legal sampling rather than statistical survey sampling.

## Proposed roles

| Role | Matrix competencies and exact evidence | Candidate courses in union | Detailed candidates in union | Feasibility |
|---|---|---:|---:|---|
| Statistical Investigator / Junior Statistical Officer | Statistics `9/1`; Survey Design `9/1`; Sampling `10/0`; Data Quality `10/1`; R Programming `10/3`; Python `5/5`; Data Visualization `10/3`; Ethics `10/1` | 69 | 11 | **High**. Strongest end-to-end demo fit. Statistical sampling itself needs authored assessment content because the search results are noisy. |
| Senior Statistical Officer | Statistics `9/1`; Survey Design `9/1`; Sampling `10/0`; Data Quality `10/1`; Data Visualization `10/3`; Project Management `10/1`; Leadership `10/1`; Communication `10/1`; Ethics `10/1` | 86 | 10 | **High**. Good managerial progression from the investigator role. Sampling has the same caveat. |
| Survey Design and Field Operations Officer | Survey Design `9/1`; Sampling `10/0`; Statistics `9/1`; Data Quality `10/1`; R Programming `10/3`; Project Management `10/1`; Communication `10/1` | 65 | 7 | **Moderate**. The HCES course is directly relevant, but the catalog does not provide a clean statistical-sampling course in this capture. |
| Household Survey Data Analyst | Statistics `9/1`; Survey Design `9/1`; R Programming `10/3`; Python `5/5`; Data Visualization `10/3`; Data Quality `10/1`; Open Data `10/1` | 59 | 11 | **High**. The detailed HCES unit-level-data course gives this role unusually specific MoSPI evidence. |
| Industrial Statistics Analyst | Industrial Statistics `4/0`; Statistics `9/1`; Survey Design `9/1`; R Programming `10/3`; Data Visualization `10/3`; Data Quality `10/1`; Project Management `10/1` | 57 | 8 | **Moderate**. Three titles are directly useful, but none has captured detail metadata. |
| Statistical Data Quality Officer | Data Quality `10/1`; Statistics `9/1`; Data Privacy `10/1`; Open Data `10/1`; Ethics `10/1`; Cybersecurity `10/1`; Project Management `10/1`; Change Management `10/1` | 75 | 8 | **High**. Strong functional and governance coverage, anchored by `Data Foundations for Governance`. |
| Statistical Data Dissemination and Open Data Officer | Open Data `10/1`; Data Visualization `10/3`; APIs `10/1`; Data Quality `10/1`; Data Privacy `10/1`; Digital Signatures `10/1`; Communication `10/1` | 70 | 9 | **High**. Strong match for dissemination, public data, interoperability, and secure exchange. |
| Geospatial Statistics Analyst | GIS `10/0`; Data Visualization `10/3`; Open Data `10/1`; APIs `10/1`; Data Quality `10/1`; SQL `10/2`; Statistics `9/1` | 68 | 9 | **Moderate**. `Mastering GIS (Level - 1)` is a clear title match, but no GIS detail page was captured. |
| Statistical Data Systems Officer | SQL `10/2`; APIs `10/1`; Cloud Computing `9/1`; Government Cloud `9/1`; Cybersecurity `10/1`; Data Privacy `10/1`; Data Quality `10/1`; Digital Signatures `10/1` | 71 | 9 | **High**. The detailed records cover SQL, API Setu, government cloud, cybersecurity, privacy, and PKI. |
| AI and Data Science Officer | AI `10/1`; Machine Learning `10/1`; Python `5/5`; R Programming `10/3`; SQL `10/2`; Data Visualization `10/3`; Ethics `10/1`; Data Privacy `10/1`; Cloud Computing `9/1` | 80 | 14 | **High**. This is the deepest technical learning path in the file. It should be a secondary role, since it is less representative of the official-statistics problem than the investigator role. |

The union columns count unique records returned for any competency in that role. They measure the size of the raw recommendation pool before relevance filtering. A course can support more than one competency, so adding the per-competency counts would overstate coverage.

## Direct catalog anchors

These titles make the strongest roles defensible. They are direct catalog evidence, not inferred titles:

- **Statistical Investigator / Junior Statistical Officer:** `Overview of Basic Statistics`, `Handling Unit Level Data of Household Consumption Expenditure Survey`, `Data Analysis using R`, `Introduction to R and Python Programming`, and `Statistical Tools and Data Visualization`.
- **Household Survey Data Analyst:** `Handling Unit Level Data of Household Consumption Expenditure Survey` includes HCES, NSO, MoSPI, NSS, unit-level data, R programming, statistical analysis, and policy analysis in its captured tags.
- **Industrial Statistics Analyst:** `Handling Unit Level Data of Annual Survey of Industries`, `Iron and Steel Sector: Statistics and Economic Indices`, and the Hindi-language Annual Survey of Industries course appear in the capture. None has detailed metadata.
- **Statistical Data Quality Officer:** `Data Foundations for Governance` covers validation, cleaning, deduplication, data quality management, governance, privacy, role-based access, and analytics preparation.
- **Statistical Data Dissemination and Open Data Officer:** `Open Data for Policymakers`, `API Setu: Enabling Digital Interoperability in Government`, `Data Storytelling`, and several visualization courses form a coherent recommendation pool.
- **Geospatial Statistics Analyst:** `Mastering GIS (Level - 1)` is the one unambiguous GIS title. The other GIS search results are mostly false positives, so this role stays moderate.
- **Statistical Data Systems Officer:** `Advanced Concepts in SQL`, `API Setu: Enabling Digital Interoperability in Government`, `Data Center Technology and Cloud Adoption in the Government Sector`, `Cybersecurity Fundamentals for Government Personnel`, `Privacy-Enhancing Technologies and Data Protection Practices`, and `National Digital Trust on PKI and Digital Signature - CCA` all have detailed metadata.
- **AI and Data Science Officer:** `Introduction to Artificial Intelligence and Machine Learning`, `Responsible AI in the Generative AI Era`, `Introduction to R and Python Programming`, `Data Analysis using R`, `Tableau_L2`, and the SQL courses have detailed metadata.

## Specialist roles that the file does not support yet

| Potential role | Search captures | Why it should wait |
|---|---:|---|
| National Accounts Statistician | 10 | All 10 titles concern financial, pension, postal, partnership, or company accounts. None is about the System of National Accounts or macroeconomic aggregates. |
| Price Statistics Officer | 2 | One title covers iron and steel economic indices; the other is a capital-goods scheme course. This is not enough for CPI, WPI, price collection, index construction, or weighting. |
| Labour Statistics Officer | 1 | The sole result is an Annual Survey of Industries course in Hindi. It does not establish labour-statistics coverage. |
| Agricultural Statistics Officer | 2 | The titles concern gender sensitization and unincorporated-enterprise survey data. Neither is an agricultural-statistics course. |
| SDG Indicators Officer | 2 | Both titles concern Panchayat performance or development indices. They may be adjacent to indicator work, but they do not support a complete SDG competency matrix. |

The application can still define these competencies in its domain model. It should mark their course coverage as unavailable or incomplete instead of returning loosely related courses.

## Recommendation for the prototype

Seed all 10 proposed roles if schedule allows. Give the Statistical Investigator / Junior Statistical Officer a complete matrix and baseline bank first. Give the other nine valid matrices and recommendation mappings, but do not spend equal time authoring assessment questions for each.

Use a catalog relevance gate before recommendation:

1. Match a gap to normalized competency tags.
2. Require title, detailed tags, description, or learning-outcome evidence. Search-term membership alone is not sufficient.
3. Rank detailed records above title-only records.
4. Return no course when evidence is weak. This is safer than recommending financial accounting for a national-accounts gap.

This matches the workflow in `/home/raja/Downloads/User_Guide.pdf`: iGOT maps KCM-aligned behavioural, functional, and domain competencies to roles, then a human verifies suggested courses before saving them. Kaushal AI can automate the first recommendation pass, but the prototype should retain source evidence and make thin coverage visible in administrator logs.

## Source notes

- [`sih.json`](../../sih.json), `source`, `scrape_summary`, and `courses`, inspected 29 August 2026.
- `/home/raja/Downloads/User_Guide.pdf`, pages 3 to 10 and 16. The guide distinguishes designations from role mappings, asks administrators to align behavioural, functional, and domain competencies with KCM, and requires course verification before saving recommendations.
