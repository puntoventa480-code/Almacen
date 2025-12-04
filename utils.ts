
export const formatCurrency = (amount: number, symbol: string = '$'): string => {
  // Forces comma as thousand separator and dot as decimal separator (e.g., 1,234.56)
  const numberString = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return `${symbol} ${numberString}`;
};

export const formatNumber = (num: number): string => {
  // Separates thousands with commas (e.g., 1,000)
  return new Intl.NumberFormat('en-US').format(num);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export const generateSKU = (): string => {
  // Generates a short, readable random code like "8X29-A1"
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${part1}-${part2}`;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  // If strict YYYY-MM-DD (from date inputs), parse strictly to avoid timezone shifts
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Fallback for ISO strings (timestamps)
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Resize image to max 500px to save LocalStorage space
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const scaleSize = MAX_WIDTH / img.width;
        
        // If image is smaller than max, don't resize up, just use original
        const finalScale = scaleSize < 1 ? scaleSize : 1;
        
        canvas.width = img.width * finalScale;
        canvas.height = img.height * finalScale;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Compress to JPEG 0.7 quality
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          reject(new Error("Could not get canvas context"));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export interface TicketItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  isBulk: boolean;
  bulkSize: number;
}

export const printTicket = (
  config: { shopName: string, currencySymbol: string },
  ticketData: {
    title: string;
    type: 'Venta' | 'Consignación';
    client: { name: string; ci: string; address: string };
    date: string;
    items: TicketItem[];
    total: number;
  }
) => {
  const receiptWindow = window.open('', '_blank');
  if (!receiptWindow) {
    alert("Por favor habilita las ventanas emergentes para imprimir el ticket.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket</title>
        <style>
          @page {
            margin: 0;
            size: 58mm auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 58mm;
            margin: 0;
            padding: 2px 2px 10px 2px;
            color: #000;
            font-size: 15px; /* Increased from 13px */
            line-height: 1.2;
            font-weight: normal; /* Removed bold */
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .left { text-align: left; }
          
          .shop-name {
            font-size: 18px; /* Increased header size */
            font-weight: normal; /* No bold */
            text-transform: uppercase;
            display: block;
            margin-bottom: 2px;
            letter-spacing: -0.5px;
          }

          .ticket-title {
            font-size: 16px;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          
          .separator {
            border-top: 1px dashed #000;
            margin: 6px 0;
            display: block;
          }
          
          .info-block {
            font-size: 14px;
            margin-bottom: 5px;
          }
          
          .item-row {
            margin-bottom: 4px;
          }
          .item-desc {
            display: block;
            width: 100%;
            margin-bottom: 1px;
            text-transform: uppercase;
          }
          .item-calc {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
          }
          
          .total-block {
            margin-top: 10px;
            padding: 5px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            font-size: 18px; /* Larger total */
            display: flex;
            justify-content: space-between;
          }
          
          .signature-box {
            margin-top: 40px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #000;
            width: 80%;
            margin: 0 auto 4px auto;
          }
          
          .footer {
            margin-top: 15px;
            text-align: center;
            font-size: 12px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="center">
          <span class="shop-name">${config.shopName}</span>
          <div class="ticket-title">${ticketData.title}</div>
          <div class="info-block">
            Nº: ${Math.floor(Math.random() * 10000)}<br>
            Fecha: ${ticketData.date}
          </div>
        </div>

        <div class="separator"></div>

        <div class="info-block left">
          CLI: ${ticketData.client.name.toUpperCase()}<br>
          ${ticketData.client.ci ? `CI: ${ticketData.client.ci}<br>` : ''}
          ${ticketData.client.address ? `DIR: ${ticketData.client.address}<br>` : ''}
          MOV: ${ticketData.type.toUpperCase()}
        </div>

        <div class="separator"></div>

        <div>
          ${ticketData.items.map(item => `
            <div class="item-row">
              <span class="item-desc">${item.name}</span>
              <div class="item-calc">
                <span>${item.quantity} ${item.isBulk ? `(Caja x${item.bulkSize}) ` : ''} x ${formatNumber(item.price)}</span>
                <span>${formatNumber(item.total)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="total-block">
          <span>TOTAL:</span>
          <span>${config.currencySymbol} ${formatNumber(ticketData.total)}</span>
        </div>

        <div class="signature-box">
          <div class="signature-line"></div>
          <div style="font-size: 12px;">Firma / Recibí Conforme</div>
        </div>

        <div class="footer">
          ¡GRACIAS POR SU COMPRA!
        </div>

        <script>
          window.print();
        </script>
      </body>
    </html>
  `;
  
  receiptWindow.document.write(html);
  receiptWindow.document.close();
};
