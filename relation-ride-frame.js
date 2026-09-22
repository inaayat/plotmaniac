export function paintRelationRideFrame({
  track,
  svg,
  sky,
  zero,
  trail,
  marks,
  cards,
  layout,
  cardTop,
  cardBand,
}) {
  track.style.width = `${layout.width}px`;
  track.style.height = `${cardTop + cardBand}px`;
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.pathHeight}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.pathHeight));
  sky.setAttribute("width", String(layout.width));
  sky.setAttribute("height", String(layout.pathHeight));
  zero.setAttribute("x2", String(layout.width));
  zero.setAttribute("y1", String(layout.zeroY));
  zero.setAttribute("y2", String(layout.zeroY));
  trail.setAttribute("d", layout.path || "");
  layout.points.forEach((point, index) => {
    marks[index]?.setAttribute("cx", String(point.x));
    marks[index]?.setAttribute("cy", String(point.y));
    const card = cards[index];
    if (!card) return;
    card.style.left = `${point.x}px`;
    card.style.top = `${cardTop}px`;
    card.style.setProperty("--stem", `${Math.max(18, cardTop - point.y)}px`);
  });
}
