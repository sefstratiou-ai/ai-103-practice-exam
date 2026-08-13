# AI-103 Practice Exam

![AI-103 Practice Exam](public/og.png)

An unofficial, browser-based practice environment for **AI-103: Developing AI Apps and Agents on Azure**.

The simulator provides a full 51-question attempt, timed and study modes, a case study, multiple item formats, a final no-review decision sequence, answer explanations, and links to the Microsoft Learn documentation behind each question. It runs locally on Windows, macOS, and Linux and does not require an Azure subscription or external service credential.

> [!IMPORTANT]
> This project is an independent learning tool. It is not affiliated with, endorsed by, or supplied by Microsoft. It contains original practice questions based on public documentation—not copied, recalled, leaked, or confidential exam content.

## Features

- 153 original, blueprint-aligned questions
- 51 questions selected for each attempt
- One seven-question, 15-paragraph case study selected from a pool of five
- 41 independent scenarios selected from a pool of 115
- Three final Yes/No decision items that lock as you advance
- Fresh question and answer ordering for every new attempt
- Exact blueprint-balanced domain coverage in every attempt
- 100-minute exam clock and an untimed study mode
- Exactly 17 interactive or special-format items per attempt (about 33%)
- An exact per-run mix of 27 single-choice, 7 multiple-response, 9 code-completion, 5 other interactive, and 3 decision items
- A 30-item code pool covering Python, JSON, HTTP/REST, and Azure CLI, plus build-list, matching, matrix, and Yes/No formats
- Deliberately close distractors drawn from the same service, SDK, role, API, or architectural family
- Mark for review, private notes, review screens, timed breaks, and section locks
- Automatic progress saving in the browser
- Answer explanations and direct links to supporting Microsoft Learn documentation
- Domain-level scoring and a scaled practice score
- No account, database, Azure subscription, API key, or telemetry required
- Optional one-click deployment to GitHub Pages

## Exam composition

Every attempt contains 51 questions distributed as follows:

| Skills measured | Official range | Questions per attempt |
| --- | ---: | ---: |
| Plan and manage an Azure AI solution | 25–30% | 14 |
| Implement generative AI and agentic solutions | 30–35% | 17 |
| Implement computer vision solutions | 10–15% | 6 |
| Implement text analysis solutions | 10–15% | 7 |
| Implement information extraction solutions | 10–15% | 7 |

The delivery order is 41 reviewable independent questions, one reviewable seven-question case study, and a final three-item Yes/No sequence. Each case study contains 15 paragraphs (about 600 or more words) distributed across several tabs to reproduce the sustained reading and cross-referencing workload described in public delivery reports. In the final sequence, each answer becomes permanent when you advance and there is no section review screen.

The question selection and displayed answer order are seeded for each attempt. They remain stable while navigating or resuming an attempt, but a new attempt produces a different selection and ordering. The selector holds both the domain distribution and the item-format mix constant, including nine code-completion questions and 17 interactive or special-format items, rather than allowing either mix to vary widely between runs.

## Fidelity calibration

The simulator separates **content grounding** from **delivery calibration**:

- Question content is original and grounded in the official AI-103 skills outline and Microsoft Learn. Every question links to the public documentation supporting its answer.
- Delivery mechanics are calibrated from Microsoft's public exam-experience guidance and anonymized public experience reports. These signals inform timing, section flow, item-format mix, navigation locks, and interface behavior only.
- Recalled live question wording and answer choices are never used. The project is not, and cannot claim to be, a one-to-one copy of a live exam form.

The current calibration uses a 100-minute scored-exam clock inside Microsoft's 120-minute associate-exam appointment window, a deliberately demanding selected-response bank, nine inline code-dropdown items, a long-form case study, code completion in Python/JSON/REST/Azure CLI, no lab section, Microsoft Learn access while the timer continues, and a final three-question no-review decision sequence. Microsoft can change the composition of individual live forms, so these are best-effort practice defaults rather than guarantees.

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) **22.13.0 or newer**
- npm, which is included with Node.js
- A current web browser

Check your installed versions:

```bash
node --version
npm --version
```

### Install and run

Clone or download this repository. From the project directory, run:

```bash
npm ci
npm run dev
```

Open the local URL printed in the terminal, normally:

```text
http://localhost:3000/
```

Keep the terminal open while using the simulator. Press `Ctrl+C` to stop the development server.

These commands work in PowerShell, Windows Terminal, Command Prompt, macOS Terminal, and common Linux shells.

### Windows launcher

After running `npm ci` once, Windows users can double-click **Start Exam.cmd**. The launcher starts the simulator, opens the default browser, and stops the local server when you press Enter in the launcher window.

If script execution is restricted by local policy, use the standard `npm run dev` command instead.

## Production mode

To create and run the application build locally:

```bash
npm run build
npm run start
```

Open the URL printed by the server. Stop it with `Ctrl+C`.

To build and preview the same static site deployed to GitHub Pages:

```bash
npm run build:pages
npm run preview:pages
```

The static output is written to `out/`. This is a separate build target; it does not change the normal clone-and-run workflow above.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run dev:pages` | Start the standalone static-site development server |
| `npm run build` | Create the production build |
| `npm run build:pages` | Create the static GitHub Pages build in `out/` |
| `npm run start` | Serve the production build locally |
| `npm run preview:pages` | Preview the static GitHub Pages build locally |
| `npm test` | Build both targets and run all automated checks |

## Deploy to GitHub Pages

The repository includes a GitHub Actions workflow that tests the project, creates the static build, applies the correct repository subpath or custom-domain URL, and deploys the result.

1. Push the project to a GitHub repository whose default branch is `main`.
2. On GitHub, open the repository and select **Settings**.
3. In the left sidebar, select **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Select the repository's **Actions** tab and open **Deploy to GitHub Pages**.
6. Select **Run workflow**, choose `main`, and confirm. A push to `main` also starts the workflow automatically.
7. Wait for both the `build` and `deploy` jobs to complete. The deployed URL appears in the workflow summary and under **Settings → Pages**.

Future pushes to `main` automatically test and redeploy the site. If your default branch has a different name, update the branch under `on.push.branches` in `.github/workflows/deploy-pages.yml` before publishing.

The workflow follows GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) model. No generated `out/` files need to be committed.

## Progress and privacy

Attempt progress, answers, flags, and private notes are saved only in the browser's local storage. The application does not send exam data to a server and does not include analytics or tracking.

Browser data is specific to the site origin. Changing the port, hostname, browser profile, or device creates a separate local save. Clearing site data removes saved attempts.

## Project structure

| Path | Description |
| --- | --- |
| `app/ExamSimulator.tsx` | Exam screens, navigation, scoring, review, and persistence |
| `app/questions.ts` | Case studies, original question bank, explanations, and sources |
| `app/questionSelection.ts` | Per-attempt case and question selection with blueprint balancing |
| `app/optionShuffle.ts` | Seeded answer-order randomization |
| `app/globals.css` | Responsive simulator styling |
| `static-site/` | Browser entry point for the standalone static build |
| `vite.pages.config.ts` | GitHub Pages base-path and static-output configuration |
| `.github/workflows/deploy-pages.yml` | Automated test, build, and Pages deployment workflow |
| `tests/` | Question-bank, selection, randomization, rendering, and build checks |
| `Start Exam.cmd` | Optional Windows launcher |

The interface is built with React and Next.js-compatible components and uses Vinext/Vite for local development and production builds.

## Content and references

The bank is aligned to the Microsoft skills measured as of **April 16, 2026**. Certification objectives and Azure services change over time, so consult the official study guide before relying on the simulator for current exam coverage.

Primary references:

- [Official AI-103 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103)
- [Official AI-103 training course](https://learn.microsoft.com/en-us/training/courses/ai-103t00)
- [Azure AI Apps and Agents Developer Associate certification](https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-apps-and-agents-developer-associate/)
- [Microsoft Foundry documentation](https://learn.microsoft.com/en-us/azure/foundry/)
- [Azure AI Search documentation](https://learn.microsoft.com/en-us/azure/search/)
- [Azure AI services documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Microsoft certification exam duration and experience](https://learn.microsoft.com/en-us/credentials/support/exam-duration-exam-experience)
- [Microsoft certification exam sandbox](https://learn.microsoft.com/en-us/credentials/certifications/exam-sandbox/)

Experience-only calibration:

- [Community review of a non-beta AI-103 delivery](https://www.reddit.com/r/AzureCertification/comments/1uchhri/review_of_just_passed_ai103_nonbeta/) — used only for aggregate delivery observations, never for recalled question content

Each question also contains a direct source link for the capability being tested.

The expanded coverage deliberately exercises areas that can be easy to under-practice in overview modules: Foundry resource creation and CLI operations, current RBAC roles and scopes, project connections, private networking, authentication and HTTP error diagnosis, Prompt Shields, image inpainting and mask requirements, video analysis, Speech REST and batch modes, Document Intelligence versus Content Understanding, and Azure AI Search schemas, vector profiles, analyzers, and immutable field attributes.

## Contributing questions

Contributions should preserve the integrity of the project:

1. Write original scenarios and answer choices in your own words.
2. Do not submit exam dumps, recalled live questions, confidential material, or content copied from commercial practice tests.
3. Align each item to a current AI-103 objective.
4. Cite an authoritative Microsoft Learn page that supports the correct answer.
5. Include a useful explanation of why the answer is correct.
6. Keep question IDs unique and preserve all configured answer types.
7. Run `npm test` before opening a pull request.

## Troubleshooting

### Node.js version error

Install Node.js 22.13.0 or newer, restart the terminal, and confirm the active version with `node --version`.

### Dependencies fail to install

Use the lockfile-based installation from the repository root:

```bash
npm ci
```

If the project was copied with an old `node_modules` directory from another operating system, remove that directory and run `npm ci` again.

### The default port is already in use

Follow the alternative local URL printed by the development server, or stop the process currently using port 3000.

### A previous attempt keeps appearing

Start a new attempt from the simulator. To remove all locally saved progress, clear site data for the simulator's local URL in your browser settings.

## Disclaimer

Microsoft, Azure, Microsoft Foundry, and Microsoft Learn are trademarks of Microsoft Corporation. Their use here is descriptive only and does not imply sponsorship or endorsement.

Passing this practice simulator does not guarantee a passing result on the certification exam. Microsoft uses its own item selection, scoring, unscored questions, and exam-delivery rules.

## License

This project is available under the [MIT License](LICENSE).

SE