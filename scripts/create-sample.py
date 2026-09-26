from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

target = Path(__file__).resolve().parents[1] / 'client/public/sample-contract.pdf'
target.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(target), pagesize=A4)
c.setTitle('Example Services Agreement - Fictional Test Document')
pages = [
    ('EXAMPLE SERVICES AGREEMENT', [
        'Fictional example for product testing. Not legal advice.',
        'This agreement is between Cedar Studio and Maple Consulting.',
        'Maple Consulting shall deliver a design report by October 30, 2026.',
        'Cedar Studio shall pay a fixed fee of $7,500 within thirty days of receipt.',
        'Both parties shall keep shared confidential information private.',
    ]),
    ('TERMINATION AND DELIVERY', [
        'Either party may terminate this agreement on fifteen days written notice.',
        'The consultant shall deliver completed work upon termination.',
        'The client shall pay for work completed before the termination date.',
        'Changes to the scope require written approval from both parties.',
    ]),
]
for index, (title, lines) in enumerate(pages, 1):
    c.setFillColorRGB(.106, .165, .29)
    c.setFont('Times-Bold', 20)
    c.drawString(48, 780, title)
    c.setFont('Times-Roman', 12)
    for row, line in enumerate(lines):
        c.drawString(48, 730 - row * 36, line)
    c.setFont('Helvetica', 9)
    c.drawString(48, 48, f'FICTIONAL EXAMPLE | Page {index} of {len(pages)}')
    c.showPage()
c.save()
print(target)
