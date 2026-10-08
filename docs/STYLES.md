# Custom styles

A style is a CSS file that yags applies on top of its built-in look. You can restyle anything: colours, borders, corner radius, spacing and fonts.

## Quick start

```bash
yags style new mine        # creates ~/.config/yags/styles/mine.css from an example
yags style use mine        # apply it
```

Open `~/.config/yags/styles/mine.css` in any editor. Every save applies straight away, so keep yags open while you edit.

```bash
yags style                 # list styles, and see which one is active
yags style off             # back to the built-in look
yags style rm mine
yags style new other ~/Downloads/other.css   # start from someone else's file
```

You can also pick a style in **Preferences → Appearance → Style**, which has a button to open the styles folder.

## How it works

- Write plain selectors such as `.yags-bar` or `.list-search-result:selected`. yags scopes them to its own window, so they never affect the rest of GNOME Shell.
- Your rules override the built-in look, including the accent, radius and opacity settings. You don't need `!important`.
- Start a selector with `.theme-light` for rules that apply only in light mode.
- Use `.yags-container` to target the outer window itself.
- GNOME Shell CSS is a subset of web CSS. Colours, `border`, `border-radius`, `padding`, `margin`, `spacing`, `font-*`, `box-shadow` and `background-gradient-*` work. Variables, `@media`, `display` and grid don't.

## Selectors

| Selector | Element |
|---|---|
| `.yags-container` | The outer window |
| `.yags-bar` | The search bar |
| `.yags-bar StEntry` | The text field in the bar |
| `.yags-ghost` | The inline completion text |
| `.yags-bar-result-icon` | The icon at the left of the bar |
| `.yags-filters`, `.yags-filter-button`, `.yags-filter-icon` | The filter buttons |
| `.yags-filter-button:checked` | The active filter |
| `.yags-results` | The results card |
| `.yags-section` | One section of results |
| `.yags-section-header` | Section titles such as "Top Hit" |
| `.list-search-result` | A result row |
| `.list-search-result:selected` | The selected row |
| `.list-search-result-title`, `.list-search-result-description` | Row title and subtitle |
| `.yags-top-hit` | The Top Hit row |
| `.yags-row-actions`, `.yags-row-action`, `.yags-row-action-icon` | The buttons on the selected row |
| `.yags-preview` | The preview pane |
| `.yags-preview-title`, `.yags-preview-kind`, `.yags-preview-body`, `.yags-preview-code` | Preview text |
| `.yags-preview-row`, `.yags-preview-key`, `.yags-preview-value` | Preview details |
| `.yags-preview-separator` | The line in the preview |
| `.yags-preview-thumb` | Image thumbnails |
| `.yags-spectrum`, `.yags-spectrum-swatch`, `.yags-spectrum-base`, `.yags-spectrum-hex` | The colour spectrum |

## Example

```css
.yags-bar,
.yags-results {
  background-color: rgba(28, 28, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.list-search-result:selected {
  background-color: rgba(255, 255, 255, 0.12);
}

.theme-light .yags-bar,
.theme-light .yags-results {
  background-color: rgba(250, 250, 250, 0.98);
}
```

There are more examples in [`examples/styles`](../examples/styles).

## Sharing

A style is a single file. Share it as a gist or put it in a repository. Others can install it with:

```bash
yags style new NAME path/to/file.css
```

If something looks wrong, `yags doctor` tells you when the active style file is missing.
