const barSettings = {
  width: 100,
  filledChar: "#",
  emptyChar: "-",
};

export function showProgressBar(totalItems: number, downloadedItems: number) {
  const percentage = Math.floor((downloadedItems / totalItems) * 100);
  const filled = Math.floor((percentage / 100) * barSettings.width);
  const empty = barSettings.width - filled;
  const bar = `[${barSettings.filledChar.repeat(filled)}${barSettings.emptyChar.repeat(empty)}] ${percentage}%`;

  process.stdout.write("\r");
  process.stdout.write(bar);
}
