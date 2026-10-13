function formatYear(iso) {
  const year = String(iso || "").slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "";
}

function presidentForEvent(event, centerId, peopleById) {
  const id = (event.people || []).find((personId) => personId !== centerId);
  return id ? peopleById.get(id) : null;
}

function portrait(person) {
  const src = person?.portrait?.src;
  if (!src) {
    const el = document.createElement("span");
    el.className = "doctrine-compare-monogram";
    const parts = String(person?.name || "?").trim().split(/\s+/);
    el.textContent = parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
    return el;
  }
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}

function resolveSelection(themes, eventsById, { themeId, personId, centerId, peopleById }) {
  const theme = themes.find((item) => item.id === themeId) || themes[0];
  const rows = (theme?.stances || [])
    .map((stance) => {
      const event = eventsById.get(stance.eventId);
      if (!event) return null;
      const president = presidentForEvent(event, centerId, peopleById);
      return { stance, event, president };
    })
    .filter(Boolean);
  const selected = rows.find((row) => row.president?.id === personId) || rows[0] || null;
  return { theme, rows, selected };
}

export function renderPresidentialDoctrinesSummary({
  plot,
  summary,
  events,
  peopleById,
  themeId = "",
  personId = "",
  onSelect,
}) {
  const themes = summary?.themes || [];
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const { theme, rows, selected } = resolveSelection(themes, eventsById, {
    themeId,
    personId,
    centerId: plot.centerId,
    peopleById,
  });

  const section = document.createElement("section");
  section.className = "doctrine-compare web";
  section.setAttribute("aria-label", "How presidential doctrines differ");

  const themesNav = document.createElement("div");
  themesNav.className = "doctrine-compare-themes";
  themesNav.setAttribute("role", "tablist");
  themesNav.setAttribute("aria-label", "Key decisions");
  themes.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doctrine-compare-theme";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(item.id === theme?.id));
    button.classList.toggle("is-active", item.id === theme?.id);
    button.textContent = item.label;
    button.addEventListener("click", () => onSelect?.({ themeId: item.id, personId }));
    themesNav.appendChild(button);
  });

  const question = document.createElement("p");
  question.className = "doctrine-compare-question";
  question.textContent = theme?.question || "";

  const split = document.createElement("div");
  split.className = "doctrine-compare-split";

  const list = document.createElement("div");
  list.className = "doctrine-compare-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", theme?.label || "Presidents");
  rows.forEach((row) => {
    const active = row === selected;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doctrine-compare-row";
    button.classList.toggle("is-active", active);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(active));
    const media = document.createElement("span");
    media.className = "doctrine-compare-row-media";
    media.appendChild(portrait(row.president));
    const copy = document.createElement("span");
    copy.className = "doctrine-compare-row-copy";
    const name = document.createElement("strong");
    const year = formatYear(row.event.date);
    name.textContent = year ? `${row.president?.name || "President"} · ${year}` : (row.president?.name || "President");
    const line = document.createElement("span");
    line.textContent = row.stance.contrast;
    copy.append(name, line);
    button.append(media, copy);
    button.addEventListener("click", () => {
      onSelect?.({ themeId: theme.id, personId: row.president?.id || "" });
    });
    list.appendChild(button);
  });

  const detail = document.createElement("article");
  detail.className = "doctrine-compare-detail";
  if (selected) {
    const head = document.createElement("header");
    head.className = "doctrine-compare-detail-head";
    const media = document.createElement("div");
    media.className = "doctrine-compare-detail-media";
    media.appendChild(portrait(selected.president));
    const titles = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "doctrine-compare-kicker";
    kicker.textContent = [formatYear(selected.event.date), theme?.label].filter(Boolean).join(" · ");
    const heading = document.createElement("h2");
    heading.textContent = selected.president?.name || "President";
    const doctrine = document.createElement("p");
    doctrine.className = "doctrine-compare-doctrine";
    doctrine.textContent = selected.event.title;
    titles.append(kicker, heading, doctrine);
    head.append(media, titles);

    const contrast = document.createElement("p");
    contrast.className = "doctrine-compare-contrast";
    contrast.textContent = selected.stance.contrast;

    const summaryText = document.createElement("p");
    summaryText.className = "doctrine-compare-summary";
    summaryText.textContent = selected.event.summary;

    detail.append(head, contrast, summaryText);
    const link = (selected.event.links || [])[0];
    if (link?.url) {
      const a = document.createElement("a");
      a.className = "doctrine-compare-source";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.label || "Wikipedia";
      detail.appendChild(a);
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No doctrines are tagged for this decision.";
    detail.appendChild(empty);
  }

  split.append(list, detail);
  section.append(themesNav, question, split);
  return section;
}
