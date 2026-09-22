import { devRuntime } from "@/lib/utils";
import type { PortInfo } from "@/types/system";

type BrandIcon = typeof import("thesvg/nodedotjs").default;
type Loader = () => Promise<{ default: BrandIcon }>;

/**
 * Each thesvg module carries every variant of its logo, wordmarks included,
 * so importing them all up front would add most of a megabyte. Loaded on
 * demand instead: each becomes its own chunk, fetched the first time a
 * process of that kind shows up.
 */
const icons = {
  angular: () => import("thesvg/angular"),
  anydesk: () => import("thesvg/anydesk"),
  apache: () => import("thesvg/apache"),
  astro: () => import("thesvg/astro"),
  brave: () => import("thesvg/brave"),
  bun: () => import("thesvg/bun"),
  caddy: () => import("thesvg/caddy"),
  chrome: () => import("thesvg/google-chrome"),
  cursor: () => import("thesvg/cursor"),
  dbeaver: () => import("thesvg/dbeaver"),
  deno: () => import("thesvg/deno"),
  discord: () => import("thesvg/discord"),
  django: () => import("thesvg/django"),
  docker: () => import("thesvg/docker"),
  dotnet: () => import("thesvg/dotnet"),
  dropbox: () => import("thesvg/dropbox"),
  edge: () => import("thesvg/microsoft-edge"),
  elasticsearch: () => import("thesvg/elasticsearch"),
  electron: () => import("thesvg/electron"),
  elixir: () => import("thesvg/elixir"),
  erlang: () => import("thesvg/erlang"),
  esbuild: () => import("thesvg/esbuild"),
  figma: () => import("thesvg/figma"),
  firefox: () => import("thesvg/firefox"),
  flask: () => import("thesvg/flask"),
  go: () => import("thesvg/go"),
  grafana: () => import("thesvg/grafana"),
  gunicorn: () => import("thesvg/gunicorn"),
  hugo: () => import("thesvg/hugo"),
  intellij: () => import("thesvg/intellij-idea"),
  java: () => import("thesvg/openjdk"),
  jupyter: () => import("thesvg/jupyter"),
  laravel: () => import("thesvg/laravel"),
  linux: () => import("thesvg/linux"),
  mariadb: () => import("thesvg/mariadb"),
  memcached: () => import("thesvg/memcached"),
  minio: () => import("thesvg/minio"),
  mongodb: () => import("thesvg/mongodb"),
  mysql: () => import("thesvg/mysql"),
  nextjs: () => import("thesvg/nextdotjs"),
  nginx: () => import("thesvg/nginx"),
  ngrok: () => import("thesvg/ngrok"),
  node: () => import("thesvg/nodedotjs"),
  nuxt: () => import("thesvg/nuxt"),
  obsidian: () => import("thesvg/obsidian"),
  ollama: () => import("thesvg/ollama"),
  onedrive: () => import("thesvg/microsoft-onedrive"),
  opera: () => import("thesvg/opera"),
  perl: () => import("thesvg/perl"),
  php: () => import("thesvg/php"),
  podman: () => import("thesvg/podman"),
  postgresql: () => import("thesvg/postgresql"),
  postman: () => import("thesvg/postman"),
  pycharm: () => import("thesvg/pycharm"),
  python: () => import("thesvg/python"),
  rabbitmq: () => import("thesvg/rabbitmq"),
  rails: () => import("thesvg/ruby-on-rails"),
  react: () => import("thesvg/react"),
  redis: () => import("thesvg/redis"),
  remix: () => import("thesvg/remix"),
  rider: () => import("thesvg/rider"),
  ruby: () => import("thesvg/ruby"),
  rust: () => import("thesvg/rust"),
  slack: () => import("thesvg/slack"),
  spotify: () => import("thesvg/spotify"),
  spring: () => import("thesvg/spring"),
  sqlserver: () => import("thesvg/microsoft-sql-server"),
  steam: () => import("thesvg/steam"),
  tailscale: () => import("thesvg/tailscale"),
  teams: () => import("thesvg/microsoft-teams"),
  teamviewer: () => import("thesvg/teamviewer"),
  telegram: () => import("thesvg/telegram"),
  traefik: () => import("thesvg/traefik"),
  vite: () => import("thesvg/vite"),
  vivaldi: () => import("thesvg/vivaldi"),
  vscode: () => import("thesvg/visual-studio-code"),
  vue: () => import("thesvg/vuedotjs"),
  webpack: () => import("thesvg/webpack"),
  webstorm: () => import("thesvg/webstorm"),
  windsurf: () => import("thesvg/windsurf"),
  zoom: () => import("thesvg/zoom"),
} satisfies Record<string, Loader>;

type IconKey = keyof typeof icons;

/**
 * Keyed by the names `describeOwner` already produces — the framework labels
 * from the Rust side and the runtime labels from `devRuntime` — so an icon
 * follows whatever the row says the process is.
 */
const BY_LABEL = new Map<string, IconKey>([
  ["Next.js", "nextjs"], ["Nuxt", "nuxt"], ["Vite", "vite"], ["Astro", "astro"],
  ["Remix", "remix"], ["Create React App", "react"], ["Vue CLI", "vue"],
  ["Angular", "angular"], ["Webpack Dev Server", "webpack"], ["Node.js", "node"],
  ["Django", "django"], ["Gunicorn", "gunicorn"], ["Uvicorn", "python"],
  ["Flask", "flask"], ["Laravel", "laravel"], ["Ruby on Rails", "rails"],
  ["Spring Boot", "spring"], ["ASP.NET Core", "dotnet"], ["Go (Air)", "go"],
  ["Rust", "rust"], ["Bun", "bun"], ["Deno", "deno"], ["Python", "python"],
  ["Java", "java"], ["Go", "go"], [".NET", "dotnet"], ["Ruby", "ruby"],
  ["PHP", "php"], ["Perl", "perl"], ["Elixir", "elixir"], ["Erlang VM", "erlang"],
  ["esbuild", "esbuild"], ["Hugo", "hugo"], ["Docker", "docker"], ["WSL", "linux"],
  ["Podman", "podman"], ["PostgreSQL", "postgresql"], ["MySQL", "mysql"],
  ["MariaDB", "mariadb"], ["SQL Server", "sqlserver"], ["Redis", "redis"],
  ["Redis (Memurai)", "redis"], ["MongoDB", "mongodb"], ["Memcached", "memcached"],
  ["Elasticsearch", "elasticsearch"], ["RabbitMQ", "rabbitmq"], ["MinIO", "minio"],
  ["nginx", "nginx"], ["Apache", "apache"], ["Caddy", "caddy"],
  ["Traefik", "traefik"], ["Grafana", "grafana"], ["ngrok", "ngrok"],
]);

/**
 * Desktop apps that commonly hold a port, keyed by executable name without
 * its extension. They have no dev label, so only the process name finds them.
 */
const BY_PROCESS = new Map<string, IconKey>([
  ["chrome", "chrome"], ["msedge", "edge"], ["firefox", "firefox"],
  ["brave", "brave"], ["opera", "opera"], ["vivaldi", "vivaldi"],
  ["code", "vscode"], ["code - insiders", "vscode"], ["cursor", "cursor"],
  ["windsurf", "windsurf"], ["idea64", "intellij"], ["webstorm64", "webstorm"],
  ["pycharm64", "pycharm"], ["rider64", "rider"], ["discord", "discord"],
  ["spotify", "spotify"], ["steam", "steam"], ["steamwebhelper", "steam"],
  ["slack", "slack"], ["zoom", "zoom"], ["ms-teams", "teams"], ["teams", "teams"],
  ["onedrive", "onedrive"], ["dropbox", "dropbox"], ["figma", "figma"],
  ["postman", "postman"], ["dbeaver", "dbeaver"], ["obsidian", "obsidian"],
  ["telegram", "telegram"], ["ollama", "ollama"], ["ollama app", "ollama"],
  ["tailscaled", "tailscale"], ["tailscale-ipn", "tailscale"],
  ["anydesk", "anydesk"], ["teamviewer", "teamviewer"],
  ["teamviewer_service", "teamviewer"], ["electron", "electron"],
  ["jupyter-lab", "jupyter"], ["jupyter-notebook", "jupyter"],
]);

/**
 * Icons whose mono variant is a poor mark at 16px, drawn from their own light
 * and dark variants instead, each shown under the matching theme. MySQL's
 * mono is the "MySQL" wordmark; its light and dark variants are the dolphin.
 */
const THEMED = new Set<IconKey>(["mysql"]);

export interface ProcessIconData {
  /** SVG markup; single-colour marks are painted with `currentColor`. */
  svg: string;
  /** Replaces `svg` under the dark theme, when the icon ships one. */
  darkSvg?: string;
  /** Brand colour, or null when it is too dark or light to read on both themes. */
  color: string | null;
  title: string;
}

/** Which icon, if any, belongs to whatever owns this port. */
export function processIconKey(entry: PortInfo): IconKey | null {
  const framework = entry.project?.framework;
  return (
    (framework && BY_LABEL.get(framework)) ||
    BY_LABEL.get(devRuntime(entry) ?? "") ||
    BY_PROCESS.get(entry.processName.toLowerCase().replace(/\.exe$/, "")) ||
    null
  );
}

const loaded = new Map<IconKey, ProcessIconData>();
const pending = new Map<IconKey, Promise<ProcessIconData>>();

/** Already loaded, so a row can render it without waiting a frame. */
export function cachedProcessIcon(key: IconKey): ProcessIconData | undefined {
  return loaded.get(key);
}

export function loadProcessIcon(key: IconKey): Promise<ProcessIconData> {
  let promise = pending.get(key);
  if (!promise) {
    promise = icons[key]().then(({ default: icon }) => {
      const data = toIconData(key, icon);
      loaded.set(key, data);
      return data;
    });
    pending.set(key, promise);
  }
  return promise;
}

/**
 * The mono variant where there is one: black logos would vanish on the dark
 * theme, and mono paths take whatever colour we give them. Full-colour logos
 * keep their own fills but get their ids namespaced, since many of them use
 * plain ids like "a" that would collide once several share a page.
 */
function toIconData(key: IconKey, icon: BrandIcon): ProcessIconData {
  const variants: Record<string, string | undefined> = icon.variants;
  if (THEMED.has(key) && variants.light && variants.dark) {
    return {
      svg: prepare(variants.light, `${key}-light`),
      darkSvg: prepare(variants.dark, `${key}-dark`),
      color: null,
      title: icon.title,
    };
  }

  const mono = icon.variants.mono;
  const svg = prepare(mono ?? icon.svg, key);
  const hex = icon.hex.length === 3 ? icon.hex.replace(/./g, "$&$&") : icon.hex;
  return {
    svg,
    color: mono && isLegible(hex) ? `#${hex}` : null,
    title: icon.title,
  };
}

/** Drops the tooltip title and gives every id a prefix unique to this icon. */
function prepare(svg: string, prefix: string): string {
  return svg
    .replace(/<title>.*?<\/title>/, "")
    .replace(/\bid="([^"]+)"/g, `id="pi-${prefix}-$1"`)
    .replace(/(url\(#|href="#)([^)"]+)/g, `$1pi-${prefix}-$2`);
}

/** Near-black and near-white brand colours fall back to the text colour. */
function isLegible(hex: string): boolean {
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return false;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.12 && luma < 0.9;
}
