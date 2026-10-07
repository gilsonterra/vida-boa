import { describe, expect, it } from 'vitest';
import { decodeOfx, OfxParseError, parseOfx, pickDescription } from './parse';

/** OFX 1.x em SGML, como exportado por bancos brasileiros (sem tags de fechamento nas folhas). */
const SGML_BANK = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261006120000[-3:BRT]<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0341
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001
<DTEND>20261005
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261002000000[-3:BRT]
<TRNAMT>-89.90
<FITID>20261002001
<MEMO>
<NAME>PAG*PADARIA SÃO JOÃO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005
<TRNAMT>15000,00
<FITID>20261005002
<NAME>SALARIO
<MEMO>SALARIO EMPRESA X &amp; Y
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>xx
<TRNAMT>-1.00
<FITID>bad
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>14910.10<DTASOF>20261005</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const XML_CARD = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <CURDEF>BRL</CURDEF>
        <CCACCTFROM><ACCTID>5555********1234</ACCTID></CCACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260901000000[-3:BRT]</DTSTART>
          <DTEND>20260930000000[-3:BRT]</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260912000000[-3:BRT]</DTPOSTED>
            <TRNAMT>-1240.00</TRNAMT>
            <FITID>abc-1</FITID>
            <MEMO>Fasano Jardins</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260915000000[-3:BRT]</DTPOSTED>
            <TRNAMT>5000.00</TRNAMT>
            <FITID>abc-2</FITID>
            <MEMO>Pagamento recebido</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL><BALAMT>-3200.00</BALAMT><DTASOF>20260930</DTASOF></LEDGERBAL>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

function latin1(s: string): Uint8Array {
	return Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
}

describe('decodeOfx', () => {
	it('lê latin-1 declarado como 1252', () => {
		expect(decodeOfx(latin1(SGML_BANK))).toContain('PAG*PADARIA SÃO JOÃO');
	});

	it('lê UTF-8 válido', () => {
		const bytes = new TextEncoder().encode(XML_CARD.replace('Fasano', 'Café'));
		expect(decodeOfx(bytes)).toContain('Café Jardins');
	});

	it('lê UTF-8 mesmo quando o cabeçalho declara 1252 (caso do Nubank)', () => {
		const bytes = new TextEncoder().encode(SGML_BANK.replace('PADARIA', 'Antecipação PADARIA'));
		expect(decodeOfx(bytes)).toContain('Antecipação PADARIA SÃO JOÃO');
	});

	it('cai para latin-1 quando o arquivo diz UTF-8 mas não é', () => {
		const lying = SGML_BANK.replace('CHARSET:1252', 'CHARSET:UTF-8');
		expect(decodeOfx(latin1(lying))).toContain('SÃO JOÃO');
	});
});

describe('parseOfx', () => {
	it('lê extrato bancário em SGML', () => {
		const { statements, warnings } = parseOfx(SGML_BANK);
		expect(statements).toHaveLength(1);
		const s = statements[0];
		expect(s).toMatchObject({
			kind: 'bank',
			currency: 'BRL',
			bankId: '0341',
			accountId: '12345-6',
			start: '2026-10-01',
			end: '2026-10-05',
			ledgerBalanceCents: 1491010
		});
		expect(s.transactions).toEqual([
			{
				fitId: '20261002001',
				date: '2026-10-02',
				amountCents: -8990,
				type: 'DEBIT',
				description: 'PAG*PADARIA SÃO JOÃO',
				checkNum: null
			},
			{
				fitId: '20261005002',
				date: '2026-10-05',
				amountCents: 1500000,
				type: 'CREDIT',
				description: 'SALARIO EMPRESA X & Y',
				checkNum: null
			}
		]);
		expect(warnings).toHaveLength(1);
	});

	it('lê fatura de cartão em XML', () => {
		const [s] = parseOfx(XML_CARD).statements;
		expect(s.kind).toBe('credit_card');
		expect(s.accountId).toBe('5555********1234');
		expect(s.transactions.map((t) => [t.date, t.amountCents, t.description])).toEqual([
			['2026-09-12', -124000, 'Fasano Jardins'],
			['2026-09-15', 500000, 'Pagamento recebido']
		]);
	});

	it('rejeita arquivos que não são OFX', () => {
		expect(() => parseOfx('nome;valor\nx;1')).toThrow(OfxParseError);
		expect(() => parseOfx('<OFX></OFX>')).toThrow(/Nenhum extrato/);
	});
});

describe('pickDescription', () => {
	it('prefere o MEMO quando o NAME está truncado', () => {
		expect(
			pickDescription(
				'SUPERMERCADO ST MARCHE VILA NOVA',
				'SUPERMERCADO ST MARCHE VILA NOVA CONCEICAO'
			)
		).toBe('SUPERMERCADO ST MARCHE VILA NOVA CONCEICAO');
		expect(pickDescription('PIX ENVIADO', 'Maria Silva')).toBe('PIX ENVIADO · Maria Silva');
		expect(pickDescription(null, 'Só memo')).toBe('Só memo');
	});
});
