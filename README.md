# claude-mods

Sanmu 自製的 Claude Code mod 集合。這個 repo 本身就是一個 plugin marketplace，裡面每個資料夾是一個 mod。（English below. 中文說明在英文段落之後。）

## English

A collection of Claude Code mods by Sanmu. The repo is itself a plugin marketplace; each folder is one mod.

### to-do

Opens a "To-do" pane at the side of the window that shows the session's task list as it changes:

- **進行中 (in progress)** ▸: what Claude is working on now (shown only when there is something)
- **待辦 (pending)** ○: tasks not started yet
- **已完成 (completed)** ✓: a folded list of everything finished, your to-dos and Claude's tasks; click it to open or close it
- A progress line at the top, such as "完成 3/7" (3 of 7 done)

The labels are in Chinese by default; set the `language` option to `en` for English (see Settings below). Tasks come from the task tools Claude already uses (`TaskCreate`, `TaskUpdate`, `TaskList`, `TodoWrite`), so there is nothing to set up. When a session starts, the list is rebuilt from the conversation, so a resumed session shows its earlier tasks; `/clear` empties it. If you close the pane, type `/to-do` to open it again.

In a terminal, the pane docks at the side in fullscreen mode at 110 columns or wider; otherwise it shows above the prompt.

**Your own to-dos and pins.** Besides Claude's tasks, the pane keeps two lists of yours. Each session has its own pane: a resumed session shows its list again, a new session (or `/clear`) starts empty. They are saved in `~/.claude/to-do/sessions/<session id>.json`.

- **My to-dos** ☐: tell Claude "add a to-do: book flights", or type `/to-do add book flights`. Click a to-do to tick it (it moves into the completed list; click it there to untick); × removes it.
- **📌 Pinned**: tell Claude "pin the mods you just recommended" and Claude saves that part of the conversation, in full, under a short title. Click the title to open or close it; × unpins it. In a terminal you can also select text in the conversation and type `/to-do pin [title]`.

**Finished work logs itself.** When Claude finishes something you asked for, it adds one line to the completed list on its own (or ticks the matching to-do of yours). Turn this off with the `autoLog` option. *Clear finished to-dos* at the bottom of the open list empties it.

Claude can also mark, list and remove these by id (n1, p1 …) when you ask. The tools it uses for this only change the mod's own list, so they run without a permission prompt.

### Install

In a Claude Code terminal session, type:

```
/plugin install to-do --marketplace linsanmufilm-svg/claude-mods
```

Press `y` to add the marketplace, then Enter to pick the user scope (loads in every session).

Or from the command line:

```bash
claude plugin marketplace add linsanmufilm-svg/claude-mods
```

```bash
claude plugin install to-do@claude-mods
```

Start a new session and the pane appears.

### Settings

| Option | Values | Default | What it does |
|---|---|---|---|
| `language` | `zh`, `en` | `zh` | Language of the pane's labels |
| `autoLog` | `true`, `false` | `true` | Claude adds each request it finishes to the completed list on its own |

Set it on the screen shown during install, or later from `/config` in a Claude Code terminal session (the plugin's rows are listed there). Changing it reloads the mod.

### Update

```bash
claude plugin marketplace update claude-mods
```

```bash
claude plugin update to-do@claude-mods
```

### Uninstall

```bash
claude plugin uninstall to-do@claude-mods
```

> These mods use Claude Code's function hooks API, which is still early access and may change between Claude Code releases.

---

## Mods

### to-do

在視窗側邊開一個「To-do」窗格，即時顯示這個 session 的任務清單：

- **進行中** ▸：Claude 正在做的任務（有才顯示）
- **待辦** ○：還沒開始的任務
- **已完成** ✓：收合的下拉清單，列出所有做完的項目（你的待辦和 Claude 的任務）；點一下展開或收合
- 最上方一行進度，例如「完成 3/7」

任務來自 Claude 本來就在用的任務工具（`TaskCreate`、`TaskUpdate`、`TaskList`、`TodoWrite`），不需要額外設定。session 開始時會從對話紀錄重建清單，所以恢復舊 session 也看得到之前的任務；`/clear` 會清空清單。窗格關掉後輸入 `/to-do` 可以再打開。

標籤預設是中文；把 `language` 選項設成 `en` 就會改成英文（見下方「設定」）。

在終端機的全螢幕模式且寬度至少 110 欄時，窗格會停靠在側邊；其他情況顯示在輸入框上方。

**自己的待辦與釘選。** 除了 Claude 的任務，窗格還有兩份你自己的清單。每個 session 有自己的窗格：恢復舊 session 會看到它原本的清單，新 session（或 `/clear` 之後）從空的開始。資料存在 `~/.claude/to-do/sessions/<session id>.json`。

- **我的待辦** ☐：跟 Claude 說「加一個待辦：訂機票」，或輸入 `/to-do add 訂機票`。點一下打勾（會移到「已完成」清單，在那裡再點一下可取消）；× 移除。
- **📌 釘選**：跟 Claude 說「把剛才建議的 mods 釘選起來」，Claude 會把那段對話的完整內容存成一則釘選，配一個短標題。點標題展開或收合；× 取消釘選。在終端機也可以先選取對話裡的文字，再輸入 `/to-do pin [標題]`。

**做完的事自動記錄。** Claude 做完你交代的事，會自己在「已完成」加一行（如果剛好是你的某個待辦，就直接把它打勾）。不想要可以把 `autoLog` 選項關掉。展開清單最下方的「清除已完成的待辦」可以清空。

你也可以請 Claude 依編號（n1、p1 …）標記完成、列出或移除這些項目。Claude 用來改這兩份清單的工具只會動這個 mod 自己的資料，所以執行時不會跳權限確認。

## 安裝

在 Claude Code 的終端機 session 裡輸入：

```
/plugin install to-do --marketplace linsanmufilm-svg/claude-mods
```

接著依序：按 `y` 加入 marketplace，再按 Enter 選 user scope（所有 session 都會載入）。

也可以用命令列安裝：

```bash
claude plugin marketplace add linsanmufilm-svg/claude-mods
```

```bash
claude plugin install to-do@claude-mods
```

裝好後開一個新的 session 就會生效。

### 設定

| 選項 | 可選值 | 預設 | 作用 |
|---|---|---|---|
| `language` | `zh`、`en` | `zh` | 窗格標籤的語言 |
| `autoLog` | `true`、`false` | `true` | Claude 做完你交代的事會自動記進「已完成」 |

安裝時的設定畫面可以直接選；之後也能在 Claude Code 終端機 session 裡輸入 `/config` 修改（plugin 的選項會列在裡面），改完 mod 會自動重新載入。

### 更新

```bash
claude plugin marketplace update claude-mods
```

```bash
claude plugin update to-do@claude-mods
```

### 移除

```bash
claude plugin uninstall to-do@claude-mods
```

## 開發

每個 mod 是一個 function-hooks plugin：

```
to-do/
├── .claude-plugin/plugin.json   # manifest
├── hooks/hooks.json             # 指向 hooks 模組
├── hooks/register.tsx           # hooks 與窗格畫面
├── hooks/tasks.ts               # 工具呼叫 → 任務清單
├── hooks/labels.ts              # 中英文標籤
├── hooks/saved.ts               # 我的待辦與釘選（存在 $.store）
├── types/index.d.ts             # $.state 的型別契約
├── tests/to-do.test.ts
└── tests/saved.test.ts
```

檢查與測試：

```bash
claude plugin validate to-do
```

```bash
claude plugin test to-do
```

新增 mod 時，在 `.claude-plugin/marketplace.json` 的 `plugins` 加一筆 `{ "name": "<mod>", "source": "./<mod>" }`。

> 這些 mod 使用 Claude Code 的 function hooks API，目前仍是 early access，Claude Code 版本更新時 API 可能變動。
