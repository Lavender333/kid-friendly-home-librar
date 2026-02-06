import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  className?: string;
  height?: number;
  width?: number;
  showValue?: boolean;
}

// Renders a crisp SVG barcode (Code128) entirely client-side.
const Barcode: React.FC<BarcodeProps> = ({ value, className = '', height = 60, width = 2, showValue = true }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'code128',
        width,
        height,
        displayValue: showValue,
        fontSize: 14,
        margin: 8,
      });
    } catch (err) {
      console.error('Barcode render failed', err);
    }
  }, [value, width, height, showValue]);

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
};

export default Barcode;
