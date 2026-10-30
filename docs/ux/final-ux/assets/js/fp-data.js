/* Find Prop — sample data for the mockups. ALL people, developers, projects, prices and listings are fictional.
   Filter vocabularies (localities, property types, amenities, furnishing, label thresholds) mirror the existing product's
   constants so the designs use the real options; see design-handoff.md for the ones that still need confirming. */
window.FP = window.FP || {};
FP.data = {
  localities: ['OMR Sholinganallur', 'OMR Navalur', 'OMR Siruseri', 'Perungudi', 'Velachery', 'Adyar', 'Besant Nagar', 'Anna Nagar', 'T Nagar', 'Porur', 'Guindy', 'Medavakkam'],
  types: ['Apartment', 'Villa', 'Independent House', 'Plot / Land', 'Commercial'],
  amenities: ['Gym', 'Swimming Pool', '24x7 Security', 'Car Park', 'Lift', 'Power Backup', 'Children Play Area', 'Clubhouse', 'Modular Kitchen', 'Fully Furnished', 'Near Metro', 'Near Beach'],
  furnishing: ['Unfurnished', 'Semi-furnished', 'Fully furnished'],
  budgetSale: ['Any budget', 'Up to ₹50 L', 'Up to ₹75 L', 'Up to ₹1 Cr', 'Up to ₹1.5 Cr', 'Up to ₹2 Cr', 'Up to ₹3 Cr'],
  budgetRent: ['Any budget', 'Up to ₹15,000', 'Up to ₹25,000', 'Up to ₹40,000', 'Up to ₹60,000', 'Up to ₹1 L'],
  user: { name: 'Priya Raman', initials: 'PR', email: 'priya.raman@example.com' },
  props: [
    { id: 1, t: '3 BHK apartment with clubhouse and covered parking', loc: 'Velachery', lt: 'sale', pt: 'Apartment', bhk: 3, bath: 2, area: '1,420', price: '₹1.25 Cr', ppsf: '₹8,803 per sq.ft', age: '2 days ago', label: 'featured', art: ['apartment', 1], furn: 'Semi-furnished' },
    { id: 2, t: 'Bright 2 BHK, a short walk from the river', loc: 'Adyar', lt: 'sale', pt: 'Apartment', bhk: 2, bath: 2, area: '1,080', price: '₹92 L', ppsf: '₹8,518 per sq.ft', age: '5 days ago', art: ['lowrise', 0], furn: 'Unfurnished' },
    { id: 3, t: 'Independent villa with private garden and terrace', loc: 'OMR Sholinganallur', lt: 'sale', pt: 'Villa', bhk: 4, bath: 4, area: '3,200', price: '₹2.85 Cr', ppsf: '₹8,906 per sq.ft', age: '1 week ago', label: 'prime', art: ['villa', 0], furn: 'Semi-furnished' },
    { id: 4, t: 'Furnished 2 BHK close to the IT corridor', loc: 'Perungudi', lt: 'rent', pt: 'Apartment', bhk: 2, bath: 2, area: '1,150', price: '₹32,000', per: '/mo', age: '3 days ago', art: ['apartment', 4], furn: 'Fully furnished' },
    { id: 5, t: 'Residential plot, corner site, east-facing', loc: 'Medavakkam', lt: 'sale', pt: 'Plot / Land', area: '1,500', price: '₹46 L', ppsf: '₹3,067 per sq.ft', age: '4 days ago', label: 'budget', art: ['plot', 2] },
    { id: 6, t: 'Compact 1 BHK, ready to move', loc: 'Porur', lt: 'sale', pt: 'Apartment', bhk: 1, bath: 1, area: '640', price: '₹38 L', ppsf: '₹5,937 per sq.ft', age: '1 day ago', label: 'budget', art: ['apartment', 4], furn: 'Unfurnished' },
    { id: 7, t: '4 BHK duplex with private terrace', loc: 'Anna Nagar', lt: 'sale', pt: 'Apartment', bhk: 4, bath: 4, area: '2,650', price: '₹3.4 Cr', ppsf: '₹12,830 per sq.ft', age: '6 days ago', label: 'prime', art: ['twin', 2], furn: 'Semi-furnished' },
    { id: 8, t: 'Ground-floor office space on a main road', loc: 'T Nagar', lt: 'rent', pt: 'Commercial', bath: 2, area: '1,800', price: '₹78,000', per: '/mo', age: '2 weeks ago', label: 'prime', art: ['commercial', 1] },
    { id: 9, t: '3 BHK semi-furnished flat with east-facing balcony', loc: 'Velachery', lt: 'rent', pt: 'Apartment', bhk: 3, bath: 2, area: '1,350', price: '₹48,000', per: '/mo', age: '3 days ago', art: ['lowrise', 1], furn: 'Semi-furnished' },
    { id: 10, t: 'Gated-community villa, 4 BHK with private garden', loc: 'OMR Navalur', lt: 'sale', pt: 'Villa', bhk: 4, bath: 5, area: '3,600', price: '₹3.1 Cr', ppsf: '₹8,611 per sq.ft', age: '9 days ago', label: 'prime', art: ['villa', 1], furn: 'Unfurnished' },
    { id: 11, t: '2 BHK independent house near the beach', loc: 'Besant Nagar', lt: 'sale', pt: 'Independent House', bhk: 2, bath: 2, area: '1,200', price: '₹1.65 Cr', ppsf: '₹13,750 per sq.ft', age: '11 days ago', label: 'prime', art: ['house', 2], furn: 'Unfurnished' },
    { id: 12, t: 'Spacious 2 BHK for rent with covered parking', loc: 'Guindy', lt: 'rent', pt: 'Apartment', bhk: 2, bath: 2, area: '1,050', price: '₹26,000', per: '/mo', age: '12 days ago', art: ['twin', 4], furn: 'Semi-furnished' },
    { id: 13, t: 'Beautifully maintained, east-facing 3 BHK apartment with a double-height living room, private lift lobby and a landscaped terrace garden in a quiet lane off Velachery Main Road', loc: 'Velachery', lt: 'sale', pt: 'Apartment', bhk: 3, bath: 3, area: '1,980', price: '₹2.05 Cr', ppsf: '₹10,353 per sq.ft', age: '3 weeks ago', label: 'prime', art: ['apartment', 3], furn: 'Fully furnished' },
  ],
  projects: [
    { id: 1, slug: 'kadal-vista', name: 'Kadal Vista', builder: 'Kadal Homes', loc: 'OMR Navalur', status: 'Under construction', range: '₹78 L – ₹1.42 Cr', bhk: ['2 BHK', '3 BHK'], featured: true, art: ['twin', 1] },
    { id: 2, slug: 'nila-grove', name: 'Nila Grove', builder: 'Nila Habitats', loc: 'Medavakkam', status: 'New launch', range: '₹62 L – ₹98 L', bhk: ['1 BHK', '2 BHK'], art: ['lowrise', 0] },
    { id: 3, slug: 'thendral-residency', name: 'Thendral Residency', builder: 'Thendral Estates', loc: 'Porur', status: 'Ready to move', range: '₹88 L – ₹1.3 Cr', bhk: ['2 BHK', '3 BHK'], art: ['twin', 2] },
    { id: 4, slug: 'arivu-heights', name: 'Arivu Heights', builder: 'Arivu Constructions', loc: 'Velachery', status: 'Under construction', range: '₹1.1 Cr – ₹1.9 Cr', bhk: ['3 BHK', '4 BHK'], featured: true, art: ['apartment', 4] },
    { id: 5, slug: 'kadal-courts', name: 'Kadal Courts', builder: 'Kadal Homes', loc: 'OMR Siruseri', status: 'New launch', range: '₹54 L – ₹86 L', bhk: ['1 BHK', '2 BHK'], art: ['commercial', 1] },
    { id: 6, slug: 'nila-meadows', name: 'Nila Meadows', builder: 'Nila Habitats', loc: 'Guindy', status: 'Ready to move', range: '₹1.4 Cr – ₹2.2 Cr', bhk: ['3 BHK'], art: ['villa', 1] },
  ],
  builders: [
    { name: 'Kadal Homes', mono: 'KH', cls: '', count: 4, about: 'Mid-rise apartment communities along the OMR corridor.', projects: [1, 5] },
    { name: 'Nila Habitats', mono: 'NH', cls: 'copper', count: 3, about: 'Compact homes and plotted layouts in south Chennai.', projects: [2, 6] },
    { name: 'Thendral Estates', mono: 'TE', cls: 'sand', count: 2, about: 'Ready-to-move apartments in west Chennai.', projects: [3, 4] },
  ],
  popular: ['Adyar', 'Anna Nagar', 'OMR Sholinganallur', 'Porur'],
  tiles: [
    ['Adyar', 'Apartments · Villas', 't1'], ['Velachery', 'Apartments · Plots', 't2'], ['Anna Nagar', 'Apartments · Commercial', 't3'],
    ['OMR Sholinganallur', 'Apartments · New projects', 't4'], ['Porur', 'Apartments · Plots', 't5'],
  ],
};
FP.byId = (arr, id) => arr.find((x) => String(x.id) === String(id));
