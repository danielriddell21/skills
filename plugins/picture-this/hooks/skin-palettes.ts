// The built-in skins of the `skins` mod (hellosverre/claude-skins 0.5.16, MIT), only the slots picture-this
// draws with, so a picture matches the skin around it. Generated from that repo's hooks/themes; a skin without
// its own light palette has none here, and picture-this keeps Claude's light colours for it.
// Slot order: fg, muted, surface, zebra, ok, err, warn, user, read, write, search, mcp
export type SkinSlots = [string, string, string, string, string, string, string, string, string, string, string, string]
export const SKIN_SLOTS = ["fg", "muted", "surface", "zebra", "ok", "err", "warn", "user", "read", "write", "search", "mcp"] as const
export const SKIN_PALETTES: Record<string, { dark: SkinSlots; light?: SkinSlots }> = {
  'ayu': { dark: ['#bfbdb6', '#626a73', '#131721', '#0f131a', '#aad94c', '#f07178', '#ffb454', '#e6b450', '#95e6cb', '#ff8f40', '#d2a6ff', '#39bae6'], light: ['#5c6166', '#8a9199', '#f3f4f5', '#f8f9fa', '#86b300', '#e65050', '#f2ae49', '#ffaa33', '#4cbf99', '#fa8d3e', '#a37acc', '#55b4d4'] },
  'catppuccin': { dark: ['#cdd6f4', '#7f849c', '#252536', '#232334', '#a6e3a1', '#f38ba8', '#f9e2af', '#cba6f7', '#89dceb', '#fab387', '#cba6f7', '#94e2d5'], light: ['#4c4f69', '#8c8fa1', '#e6e9ef', '#eceef3', '#40a02b', '#d20f39', '#df8e1d', '#8839ef', '#04a5e5', '#fe640b', '#8839ef', '#179299'] },
  'dracula': { dark: ['#f8f8f2', '#6272a4', '#2b2d3a', '#2a2c37', '#50fa7b', '#ff5555', '#f1fa8c', '#bd93f9', '#8be9fd', '#ffb86c', '#bd93f9', '#50fa7b'] },
  'everforest': { dark: ['#d3c6aa', '#859289', '#3d484d', '#343f44', '#a7c080', '#e67e80', '#dbbc7f', '#a7c080', '#7fbbb3', '#e69875', '#d699b6', '#83c092'], light: ['#5c6a72', '#939f91', '#efebd4', '#f4f0d9', '#8da101', '#f85552', '#dfa000', '#8da101', '#3a94c5', '#f57d26', '#df69ba', '#35a77c'] },
  'github': { dark: ['#e6edf3', '#7d8590', '#161b22', '#11161d', '#3fb950', '#f85149', '#d29922', '#58a6ff', '#79c0ff', '#ffa657', '#d2a8ff', '#56d4dd'], light: ['#1f2328', '#656d76', '#f6f8fa', '#fafbfc', '#1a7f37', '#cf222e', '#9a6700', '#0969da', '#0969da', '#bc4c00', '#8250df', '#1b7c83'] },
  'gruvbox': { dark: ['#ebdbb2', '#928374', '#32302f', '#2f2c2a', '#b8bb26', '#fb4934', '#fe8019', '#fabd2f', '#83a598', '#fe8019', '#d3869b', '#fabd2f'] },
  'kanagawa': { dark: ['#dcd7ba', '#727169', '#2a2a37', '#232330', '#98bb6c', '#e46876', '#e6c384', '#7e9cd8', '#7fb4ca', '#ffa066', '#957fb8', '#7aa89f'], light: ['#545464', '#8a8980', '#e7dba0', '#ede5b4', '#6f894e', '#c84053', '#836f4a', '#4d699b', '#4e8ca2', '#cc6d00', '#624c83', '#597b75'] },
  'mono': { dark: ['#e0e0e0', '#7a7a7a', '#262626', '#222222', '#e0e0e0', '#ffffff', '#bdbdbd', '#e0e0e0', '#9e9e9e', '#e0e0e0', '#9e9e9e', '#9e9e9e'] },
  'night-owl': { dark: ['#d6deeb', '#637777', '#0b2942', '#071d33', '#addb67', '#ef5350', '#ecc48d', '#82aaff', '#7fdbca', '#f78c6c', '#c792ea', '#7fdbca'] },
  'noir': { dark: ['#ededed', '#8c8c8c', '#151515', '#1c1c1c', '#ededed', '#f87171', '#a3a3a3', '#f5f5f5', '#ededed', '#ededed', '#ededed', '#ededed'], light: ['#151515', '#6b6b6b', '#ffffff', '#f2f2f2', '#151515', '#c42b2b', '#6b6b6b', '#111111', '#111111', '#111111', '#111111', '#111111'] },
  'nord': { dark: ['#e5e9f0', '#7b88a1', '#3b4252', '#353b49', '#a3be8c', '#bf616a', '#ebcb8b', '#88c0d0', '#8fbcbb', '#d08770', '#b48ead', '#88c0d0'] },
  'one-dark': { dark: ['#abb2bf', '#5c6370', '#2c313a', '#262a31', '#98c379', '#e06c75', '#e5c07b', '#61afef', '#56b6c2', '#d19a66', '#c678dd', '#56b6c2'], light: ['#383a42', '#a0a1a7', '#f0f0f1', '#f5f5f6', '#50a14f', '#e45649', '#c18401', '#4078f2', '#0184bc', '#986801', '#a626a4', '#0184bc'] },
  'rose-pine': { dark: ['#e0def4', '#6e6a86', '#26233a', '#1f1d2e', '#9ccfd8', '#eb6f92', '#f6c177', '#c4a7e7', '#9ccfd8', '#ebbcba', '#c4a7e7', '#31748f'], light: ['#575279', '#9893a5', '#f2e9e1', '#fffaf3', '#56949f', '#b4637a', '#ea9d34', '#907aa9', '#56949f', '#d7827e', '#907aa9', '#286983'] },
  'solarized': { dark: ['#93a1a1', '#586e75', '#073642', '#04313c', '#859900', '#dc322f', '#b58900', '#268bd2', '#2aa198', '#cb4b16', '#6c71c4', '#2aa198'], light: ['#586e75', '#93a1a1', '#eee8d5', '#f5efdc', '#859900', '#dc322f', '#b58900', '#268bd2', '#2aa198', '#cb4b16', '#6c71c4', '#2aa198'] },
  'tokyo-night': { dark: ['#c0caf5', '#737aa2', '#1f2335', '#1d2030', '#9ece6a', '#f7768e', '#e0af68', '#7aa2f7', '#7dcfff', '#ff9e64', '#bb9af7', '#73daca'], light: ['#3760bf', '#848cb5', '#d0d5e3', '#dfe2eb', '#587539', '#f52a65', '#8c6c3e', '#2e7de9', '#007197', '#b15c00', '#7847bd', '#118c74'] },
}
