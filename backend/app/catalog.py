"""Indian generic medicine catalog. Commercial fields are illustrative demo data."""
from .pharmacy import pharmacy_defaults

SOURCE = 'https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadConsumer/nlem2022.pdf'


def medicine_products():
    # Generic name, strength, dosage form, category, example trade pack,
    # demo price (paise), demo stock, reorder threshold, artwork, background.
    rows = [
        ('Paracetamol', '500 mg', 'Tablets', 'Pain & fever', 'Strip of 10 tablets', 2200, 180, 25, 'tablets', '#e5edf0'),
        ('Paracetamol', '650 mg', 'Tablets', 'Pain & fever', 'Strip of 15 tablets', 3300, 240, 40, 'tablets', '#e6eee7'),
        ('Ibuprofen', '400 mg', 'Tablets', 'Pain & fever', 'Strip of 10 tablets', 2800, 96, 20, 'tablets', '#eee8f2'),
        ('Cetirizine', '10 mg', 'Tablets', 'Allergy care', 'Strip of 10 tablets', 2500, 14, 25, 'tablets', '#e2eee9'),
        ('Amoxicillin', '500 mg', 'Capsules', 'Antibiotics', 'Strip of 10 capsules', 8500, 72, 15, 'capsules', '#e3eaf5'),
        ('Azithromycin', '500 mg', 'Tablets', 'Antibiotics', 'Strip of 3 tablets', 7500, 120, 25, 'tablets', '#ede8f4'),
        ('Cefixime', '200 mg', 'Tablets', 'Antibiotics', 'Strip of 10 tablets', 11000, 0, 20, 'tablets', '#e7eef3'),
        ('Metformin', '500 mg', 'Tablets', 'Diabetes care', 'Strip of 20 tablets', 3800, 84, 20, 'tablets', '#e0eeeb'),
        ('Metformin', '1000 mg', 'Tablets', 'Diabetes care', 'Strip of 10 tablets', 4200, 110, 25, 'tablets', '#e4eeee'),
        ('Glimepiride', '1 mg', 'Tablets', 'Diabetes care', 'Strip of 10 tablets', 4500, 65, 15, 'tablets', '#e6eee5'),
        ('Amlodipine', '5 mg', 'Tablets', 'Cardiovascular', 'Strip of 10 tablets', 3000, 150, 30, 'tablets', '#e6eafa'),
        ('Telmisartan', '40 mg', 'Tablets', 'Cardiovascular', 'Strip of 10 tablets', 6500, 90, 20, 'tablets', '#e3eaf3'),
        ('Atorvastatin', '10 mg', 'Tablets', 'Cardiovascular', 'Strip of 10 tablets', 5500, 70, 20, 'tablets', '#ede6f0'),
        ('Omeprazole', '20 mg', 'Capsules', 'Gastrointestinal', 'Strip of 10 capsules', 4000, 105, 25, 'capsules', '#e6eee0'),
        ('Ondansetron', '4 mg', 'Tablets', 'Gastrointestinal', 'Strip of 10 tablets', 4800, 60, 15, 'tablets', '#e5ecf2'),
        ('Salbutamol', '100 mcg/dose', 'MDI inhaler', 'Respiratory', '1 inhaler · demo 200-dose pack', 16000, 32, 10, 'inhaler', '#e1eef0'),
        ('Budesonide', '200 mcg/dose', 'MDI inhaler', 'Respiratory', '1 inhaler · demo 200-dose pack', 31000, 28, 10, 'inhaler', '#e9e8f3'),
        ('Ascorbic Acid', '500 mg', 'Tablets', 'Vitamins & minerals', 'Strip of 15 tablets', 3500, 160, 30, 'tablets', '#f3eadb'),
        ('Folic Acid', '5 mg', 'Tablets', 'Vitamins & minerals', 'Strip of 30 tablets', 3200, 130, 25, 'tablets', '#f2e6e3'),
        ('Cholecalciferol', '60000 IU', 'Capsules', 'Vitamins & minerals', 'Strip of 4 capsules', 9500, 78, 20, 'capsules', '#f3eddc'),
        ('Clotrimazole', '1% w/w', 'Cream', 'Skin care', 'Tube of 15 g', 5000, 85, 20, 'tube', '#e1eee8'),
        ('Povidone Iodine', '5% w/v', 'Topical solution', 'Skin care', 'Bottle of 100 ml', 7500, 48, 15, 'bottle', '#efe4dd'),
        ('Oral Rehydration Salts', 'Low-osmolarity formula', 'Powder', 'Rehydration', '1 sachet · demo 20.5 g pack', 2000, 200, 40, 'sachet', '#e5efdf'),
        ('Levothyroxine', '50 mcg', 'Tablets', 'Thyroid care', 'Bottle of 100 tablets', 12000, 52, 15, 'bottle', '#e6eaf5'),
    ]
    products = []
    for i, (generic, strength, form, category, pack, price, stock, reorder, art, color) in enumerate(rows, 1):
        products.append(dict(id='med%02d' % i, name=generic + ' ' + strength,
                             generic_name=generic, strength=strength, dosage_form=form,
                             brand='Generic medicine', category=category,
                             sku='MED-%03d' % i, unit=pack, price=price, stock=stock,
                             reorder=reorder, art=art, color=color,
                             distributor_id='distributor', active=True,
                             demo=True, reference_url=SOURCE))
    for product in products:
        pharmacy_defaults(product, sample=True)
    return products
