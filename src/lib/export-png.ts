export function exportChartPNG(
  svgElement: SVGSVGElement,
  scenarioName: string,
): void {
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // Inject dark background as the first child of the SVG
  const bgRect = `<rect width="100%" height="100%" fill="#09090b"/>`;
  svgString = svgString.replace(/>/, `>${bgRect}`);

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const scale = 2; // Retina
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${scenarioName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-chart.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };

  img.src = url;
}
