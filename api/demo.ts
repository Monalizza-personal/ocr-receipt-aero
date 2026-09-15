export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { type } = req.query || {};

  if (type === "food") {
    return res.status(200).json({
      storeName: "سوبرماركت التميمي والأسواق المركزية",
      storeNameEn: "Tamimi Supermarkets & Fresh Market",
      storeAddress: "طريق الملك فهد، العليا، الرياض",
      storeAddressEn: "King Fahd Road, Al Olaya, Riyadh, Saudi Arabia",
      storePhone: "0112199000",
      taxId: "300054892100003",
      invoiceNo: "TAM-" + Math.floor(10000 + Math.random() * 90000),
      date: new Date().toISOString().split("T")[0],
      time: "14:22",
      currency: "SAR",
      category: "Food & Dining",
      paymentMethod: "Apple Pay",
      subtotal: 135.5,
      vatTotal: 20.33,
      grandTotal: 155.83,
      notes: "Weekly fresh kitchen pantry and produce replenishment.",
      items: [
        {
          description: "زيت زيتون بكر ممتاز 2 لتر ساسو",
          descriptionEn: "Extra Virgin Olive Oil 2L SASSO",
          quantity: 1,
          unitPrice: 65.0,
          vatAmount: 9.75,
          totalAmount: 74.75,
          category: "Food & Dining",
          productChoice: "Pantry",
        },
        {
          description: "أرز بسمتي أبيض سيلا الشعلان 5 كجم",
          descriptionEn: "Al Shalan Sella White Basmati Rice 5KG",
          quantity: 1,
          unitPrice: 42.0,
          vatAmount: 6.3,
          totalAmount: 48.3,
          category: "Food & Dining",
          productChoice: "Pantry",
        },
        {
          description: "حليب طويل الأجل المراعي كامل الدسم كرتون 4x1 لتر",
          descriptionEn: "Almarai Long Life Whole Milk 4x1L",
          quantity: 1,
          unitPrice: 28.5,
          vatAmount: 4.28,
          totalAmount: 32.78,
          category: "Food & Dining",
          productChoice: "Dairy",
        },
      ],
    });
  }

  if (type === "electronics") {
    return res.status(200).json({
      storeName: "مؤسسة إكسترا للإلكترونيات والأجهزة",
      storeNameEn: "eXtra Electronics Retail Trading Co",
      storeAddress: "طريق الدائري الشمالي، الرياض",
      storeAddressEn: "Northern Ring Road, Riyadh, Saudi Arabia",
      storePhone: "920004444",
      taxId: "300481290300003",
      invoiceNo: "EXT-" + Math.floor(10000 + Math.random() * 90000),
      date: new Date().toISOString().split("T")[0],
      time: "17:40",
      currency: "SAR",
      category: "Electronics",
      paymentMethod: "Credit Card",
      subtotal: 1450.0,
      vatTotal: 217.5,
      grandTotal: 1667.5,
      notes: "Commercial kitchen digital POS tablet and thermal printer.",
      items: [
        {
          description: "شاشة نقاط البيع الذكية اللمسية مع ملحقاتها",
          descriptionEn: "Smart Touch POS Terminal Display 15.6 Inch",
          quantity: 1,
          unitPrice: 1100.0,
          vatAmount: 165.0,
          totalAmount: 1265.0,
          category: "Electronics",
          productChoice: "Hardware",
        },
        {
          description: "طابعة فواتير وإيصالات حرارية 80 مم شبكية",
          descriptionEn: "Thermal Receipt Printer 80mm Network/USB",
          quantity: 1,
          unitPrice: 350.0,
          vatAmount: 52.5,
          totalAmount: 402.5,
          category: "Electronics",
          productChoice: "Hardware",
        },
      ],
    });
  }

  return res.status(200).json({
    storeName: "متجر الأخضر للأجهزة المنزلية",
    storeNameEn: "Green Store Household & Kitchen Appliances",
    storeAddress: "المدينة المنورة، سوق الحراج، المملكة العربية السعودية",
    storeAddressEn: "Al-Madinah Al-Munawwarah, Al-Haraj Market, Saudi Arabia",
    storePhone: "0540883720",
    taxId: "310423670800003",
    invoiceNo: "2025/00008/04",
    date: new Date().toISOString().split("T")[0],
    time: "15:45",
    currency: "SAR",
    category: "Household",
    paymentMethod: "Card",
    subtotal: 2695.65,
    vatTotal: 404.35,
    grandTotal: 3100.0,
    notes: "Commercial heavy appliance delivery and installation voucher.",
    items: [
      {
        description: "ثلاجة ميديا بابين سعة 400 لتر موفرة للطاقة",
        descriptionEn: "Midea Double Door Refrigerator 400L Energy Saver",
        quantity: 1,
        unitPrice: 2695.65,
        vatAmount: 404.35,
        totalAmount: 3100.0,
        category: "Household",
        productChoice: "Refrigeration Unit",
      },
    ],
  });
}
