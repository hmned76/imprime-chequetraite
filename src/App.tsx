import { useState, useCallback, useMemo } from 'react'
import { FaPrint, FaCheck, FaFileInvoice, FaExchangeAlt } from 'react-icons/fa'

const BANQUES = [
  { code: '01', nom: 'Arab Tunisian Bank', abbr: 'ATB' },
  { code: '03', nom: 'Banque Nationale Agricole', abbr: 'BNA' },
  { code: '04', nom: 'Attijari Bank', abbr: 'ABT' },
  { code: '05', nom: 'Banque de Tunisie', abbr: 'BT' },
  { code: '07', nom: 'Amen Bank', abbr: 'AB' },
  { code: '08', nom: 'Banque Internationale Arabe de Tunisie', abbr: 'BIAT' },
  { code: '10', nom: 'Société Tunisienne de Banque', abbr: 'STB' },
  { code: '11', nom: "Union Bancaire pour le Commerce et l'Industrie", abbr: 'UBCI' },
  { code: '12', nom: 'Union Internationale de Banques', abbr: 'UIB' },
  { code: '14', nom: "Banque de l'Habitat", abbr: 'BH' },
  { code: '16', nom: 'Citibank', abbr: 'CITIBANK' },
  { code: '17', nom: 'Office National des Postes', abbr: 'CCP' },
  { code: '20', nom: 'Banque Tuniso-Koweïtienne', abbr: 'BTK' },
  { code: '21', nom: 'Tunisian Saudi Bank', abbr: 'TSB' },
  { code: '23', nom: 'Qatar National Bank', abbr: 'QNB' },
  { code: '24', nom: 'Banque de Tunisie et des Émirats', abbr: 'BTE' },
  { code: '25', nom: 'Banque Zitouna', abbr: 'BZ' },
  { code: '26', nom: 'Banque Tuniso-Libyenne', abbr: 'BTL' },
  { code: '27', nom: 'Banque Tunisienne de Solidarité', abbr: 'BTS' },
  { code: '28', nom: 'Bank ABC', abbr: 'ABC' },
  { code: '32', nom: 'Al Baraka Bank Tunisie', abbr: 'ALBARAKA' },
  { code: '33', nom: 'North Africa International Bank', abbr: 'NAIB' },
  { code: '35', nom: 'Alubaf Tunis', abbr: 'ALUBAF' },
  { code: '47', nom: 'Wifak Bank', abbr: 'WIB' },
  { code: '73', nom: 'Tunis International Bank', abbr: 'TIB' },
]

const VILLES = [
  'Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès', 'Monastir',
  'Ben Arous', 'Nabeul', 'Ariana', 'Manouba', 'Médenine', 'Tozeur',
  'Gafsa', 'Kasserine', 'Jendouba', 'Mahdia', 'Zarzis', 'Djerba',
]

function montantEnLettres(montant: number): string {
  if (montant === 0) return ''
  const units = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf']
  const teens = ['Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-sept', 'Dix-huit', 'Dix-neuf']
  const tens = ['', 'Dix', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-dix', 'Quatre-vingts', 'Quatre-vingt-dix']

  function convertGroup(n: number): string {
    if (n === 0) return ''
    if (n < 10) return units[n]
    if (n < 20) return teens[n - 10]
    if (n < 100) {
      const t = Math.floor(n / 10)
      const u = n % 10
      if (t === 7) return 'Soixante-dix' + (u ? '-' + units[u] : '')
      if (t === 9) return 'Quatre-vingt-dix' + (u ? '-' + units[u] : '')
      return tens[t] + (u ? '-' + units[u] : '')
    }
    if (n < 1000) {
      const h = Math.floor(n / 100)
      const rest = n % 100
      const hStr = h === 1 ? 'Cent' : units[h] + ' Cent'
      return hStr + (rest ? ' ' + convertGroup(rest) : '')
    }
    if (n < 1000000) {
      const th = Math.floor(n / 1000)
      const rest = n % 1000
      const thStr = th === 1 ? 'Mille' : convertGroup(th) + ' Mille'
      return thStr + (rest ? ' ' + convertGroup(rest) : '')
    }
    return String(n)
  }

  const dirham = Math.floor(montant)
  const millimes = Math.round((montant - dirham) * 1000)
  const dirhamStr = convertGroup(dirham)
  const millimesStr = millimes > 0 ? convertGroup(millimes) + ' Millimes' : ''
  return dirhamStr + (millimesStr ? ' Dinars ' + millimesStr : ' Dinars')
}

function formatDateLong(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface ChequeForm {
  date: string
  ville: string
  beneficiaire: string
  montantChiffres: string
  banqueCode: string
  agence: string
  numeroCompte: string
  numeroCheque: string
  tireur: string
}

interface TraiteForm {
  date: string
  ville: string
  tireur: string
  adresseTireur: string
  tiree: string
  adresseTiree: string
  beneficiaire: string
  montantChiffres: string
  dateEcheance: string
  lieuPaiement: string
  remise: string
}

export default function App() {
  const [mode, setMode] = useState<'cheque' | 'traite'>('cheque')

  const [cheque, setCheque] = useState<ChequeForm>({
    date: new Date().toISOString().split('T')[0],
    ville: 'Tunis',
    beneficiaire: '',
    montantChiffres: '',
    banqueCode: '05',
    agence: '001',
    numeroCompte: '',
    numeroCheque: '',
    tireur: '',
  })

  const [traite, setTraite] = useState<TraiteForm>({
    date: new Date().toISOString().split('T')[0],
    ville: 'Tunis',
    tireur: '',
    adresseTireur: '',
    tiree: '',
    adresseTiree: '',
    beneficiaire: '',
    montantChiffres: '',
    dateEcheance: '',
    lieuPaiement: 'Tunis',
    remise: '',
  })

  const handleCheque = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setCheque(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleTraite = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setTraite(prev => ({ ...prev, [name]: value }))
  }, [])

  const banqueChoisie = useMemo(() => BANQUES.find(b => b.code === cheque.banqueCode), [cheque.banqueCode])
  const montantLettresCheque = useMemo(() => montantEnLettres(parseFloat(cheque.montantChiffres) || 0), [cheque.montantChiffres])
  const montantLettresTraite = useMemo(() => montantEnLettres(parseFloat(traite.montantChiffres) || 0), [traite.montantChiffres])

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 shadow-lg no-print">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg">
            <FaExchangeAlt className="text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ImprimCheques</h1>
            <p className="text-blue-200 text-xs">Imprime Chèques & Traites - République Tunisienne</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 flex gap-6 flex-col lg:flex-row">
        <div className="lg:w-[420px] space-y-4 no-print">
          <div className="bg-white rounded-lg shadow p-3 flex gap-2">
            <button
              onClick={() => setMode('cheque')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-semibold transition text-sm ${mode === 'cheque' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <FaCheck /> Chèque
            </button>
            <button
              onClick={() => setMode('traite')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-semibold transition text-sm ${mode === 'traite' ? 'bg-amber-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <FaFileInvoice /> Traite
            </button>
          </div>

          {mode === 'cheque' ? (
            <FormulaireCheque cheque={cheque} onChange={handleCheque} />
          ) : (
            <FormulaireTraite traite={traite} onChange={handleTraite} />
          )}

          <button onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition shadow-lg">
            <FaPrint /> Imprimer
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-800 mb-3 no-print">Aperçu</h2>
          {mode === 'cheque' ? (
            <ApercuCheque cheque={cheque} banqueChoisie={banqueChoisie} montantLettres={montantLettresCheque} />
          ) : (
            <ApercuTraite traite={traite} montantLettres={montantLettresTraite} />
          )}
        </div>
      </div>
    </div>
  )
}

function FormulaireCheque({ cheque, onChange }: { cheque: ChequeForm; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <h2 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
        <FaCheck className="text-blue-600" /> Remplir le chèque
      </h2>

      <p className="text-[11px] text-gray-500 italic">
        Les mentions imprimées (banque, n° chèque, compte, titulaire) sont déjà pré-remplies. Remplissez uniquement les champs ci-dessous.
      </p>

      <div className="bg-gray-50 border rounded p-3 space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Mentions pré-imprimées (non modifiables)</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Banque : </span>
            <span className="font-bold text-gray-800">[{cheque.banqueCode}] {BANQUES.find(b => b.code === cheque.banqueCode)?.nom}</span>
          </div>
          <div>
            <span className="text-gray-500">Agence : </span>
            <span className="font-mono font-bold text-gray-800">{cheque.agence}</span>
          </div>
          <div>
            <span className="text-gray-500">N° Chèque : </span>
            <span className="font-mono font-bold text-gray-800">{cheque.numeroCheque || '(imprimé)'}</span>
          </div>
          <div>
            <span className="text-gray-500">N° Compte : </span>
            <span className="font-mono font-bold text-gray-800">{cheque.numeroCompte || '(imprimé)'}</span>
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Titulaire : </span>
          <span className="text-xs font-bold text-gray-800">{cheque.tireur || '(imprimé)'}</span>
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Champs à remplir manuscritement ou ici :</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date d'émission</label>
            <input type="date" name="date" value={cheque.date} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Lieu</label>
            <select name="ville" value={cheque.ville} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Bénéficiaire (Payer à l'ordre de)</label>
          <input type="text" name="beneficiaire" value={cheque.beneficiaire} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Nom du bénéficiaire" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Montant en chiffres (DT)</label>
          <input type="number" step="0.001" min="0" name="montantChiffres" value={cheque.montantChiffres} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg font-mono" placeholder="0.000" />
          <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded">
            <span className="text-[10px] text-blue-600 font-semibold uppercase">Montant en lettres : </span>
            <span className="text-sm text-blue-800 font-bold italic">
              {montantEnLettres(parseFloat(cheque.montantChiffres) || 0) || 'Saisissez le montant ci-dessus'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormulaireTraite({ traite, onChange }: { traite: TraiteForm; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <h2 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
        <FaFileInvoice className="text-amber-600" /> Remplir la traite
      </h2>

      <p className="text-[11px] text-gray-500 italic">
        La lettre de change est régie par les articles 269 à 338 du Code de Commerce Tunisien. Toute mention manquante lui fait perdre sa valeur cambiaire.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date d'émission</label>
          <input type="date" name="date" value={traite.date} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Lieu d'émission</label>
          <select name="ville" value={traite.ville} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Tireur ( Créancier )</p>
        <div>
          <label className="block text-[11px] text-gray-600 mb-0.5">Nom / Raison sociale</label>
          <input type="text" name="tireur" value={traite.tireur} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Nom du tireur" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-600 mb-0.5">Adresse</label>
          <input type="text" name="adresseTireur" value={traite.adresseTireur} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Adresse du tireur" />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Tiré ( Débiteur / Doit payer )</p>
        <div>
          <label className="block text-[11px] text-gray-600 mb-0.5">Nom / Raison sociale</label>
          <input type="text" name="tiree" value={traite.tiree} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Nom du tiré" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-600 mb-0.5">Adresse</label>
          <input type="text" name="adresseTiree" value={traite.adresseTiree} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Adresse du tiré" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Bénéficiaire (Porteur)</label>
        <input type="text" name="beneficiaire" value={traite.beneficiaire} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Nom du bénéficiaire" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Échéance</label>
          <input type="date" name="dateEcheance" value={traite.dateEcheance} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Lieu de paiement</label>
          <select name="lieuPaiement" value={traite.lieuPaiement} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Montant en chiffres (DT)</label>
        <input type="number" step="0.001" min="0" name="montantChiffres" value={traite.montantChiffres} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-lg font-mono" placeholder="0.000" />
        <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded">
          <span className="text-[10px] text-amber-600 font-semibold uppercase">Montant en lettres : </span>
          <span className="text-sm text-amber-800 font-bold italic">
            {montantEnLettres(parseFloat(traite.montantChiffres) || 0) || 'Saisissez le montant ci-dessus'}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Remise / Référence</label>
        <input type="text" name="remise" value={traite.remise} onChange={onChange} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="N° facture ou bordereau" />
      </div>
    </div>
  )
}

function ApercuCheque({ cheque, banqueChoisie, montantLettres }: {
  cheque: ChequeForm; banqueChoisie: typeof BANQUES[0] | undefined; montantLettres: string
}) {
  const rib = `${cheque.banqueCode} ${cheque.agence} ${cheque.numeroCompte || '____________________'}`
  return (
    <div id="check-preview" className="bg-white border-2 border-gray-400 shadow-xl overflow-hidden rounded" style={{ width: '100%', maxWidth: '720px' }}>
      {/* Bande supérieure colorée */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 text-white px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white text-blue-900 font-bold text-xs px-2 py-1 rounded">{banqueChoisie?.abbr || 'BT'}</div>
          <div>
            <div className="font-bold text-sm tracking-wide">{banqueChoisie?.nom || 'Banque de Tunisie'}</div>
            <div className="text-[10px] text-blue-200">Agence {cheque.agence}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-blue-200 uppercase tracking-wider">Chèque N°</div>
          <div className="font-mono font-bold text-lg leading-none">{cheque.numeroCheque || '00000000'}</div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Ligne : Fait à + Date */}
        <div className="text-xs text-gray-700">
          <span className="text-gray-500">Fait à </span>
          <span className="font-bold border-b border-dashed border-gray-400 inline-block min-w-[120px] text-center">{cheque.ville || '______'}</span>
          <span className="text-gray-500">, le </span>
          <span className="font-bold border-b border-dashed border-gray-400 inline-block min-w-[150px] text-center">{formatDateLong(cheque.date)}</span>
        </div>

        {/* Payer à l'ordre de */}
        <div className="text-xs">
          <div className="text-gray-500 mb-1">Payer à l'ordre de</div>
          <div className="border-b-2 border-gray-300 font-bold text-gray-900 py-1 text-base min-h-[28px]">
            {cheque.beneficiaire || '____________________________________________________'}
          </div>
        </div>

        {/* Somme de */}
        <div className="text-xs">
          <div className="text-gray-500 mb-1">La somme de</div>
          <div className="border-b-2 border-gray-300 font-semibold text-gray-800 py-1 italic min-h-[24px]">
            {montantLettres ? montantLettres + ' *******' : '____________________________________________________'}
          </div>
        </div>

        {/* Montant en chiffres + Compte */}
        <div className="flex items-end justify-between gap-4">
          <div className="text-xs flex-1">
            <span className="text-gray-500">N° Compte : </span>
            <span className="font-mono font-bold text-gray-900 border-b border-gray-300 inline-block min-w-[200px]">{cheque.numeroCompte || '____________________'}</span>
          </div>
          <div className="border-2 border-blue-700 rounded-lg px-5 py-2 bg-blue-50 flex-shrink-0">
            <div className="text-[9px] text-gray-500 text-center uppercase tracking-wide">Montant</div>
            <div className="font-mono text-2xl font-bold text-blue-900 leading-tight">
              {cheque.montantChiffres ? parseFloat(cheque.montantChiffres).toFixed(3) : '__.___'}
            </div>
            <div className="text-[9px] text-gray-500 text-center">DT (Dinars Tunisiens)</div>
          </div>
        </div>

        {/* RIB */}
        <div className="text-[10px] text-gray-400 border-t border-dashed border-gray-300 pt-2">
          <span className="font-mono">RIB : {rib}</span>
        </div>

        {/* Signature */}
        <div className="flex justify-between items-end pt-3">
          <div className="text-[10px] text-gray-400 italic">Signature du titulaire</div>
          <div className="w-52 border-b-2 border-gray-300"></div>
        </div>
      </div>
    </div>
  )
}

function ApercuTraite({ traite, montantLettres }: { traite: TraiteForm; montantLettres: string }) {
  return (
    <div id="check-preview" className="bg-white border-2 border-gray-400 shadow-xl overflow-hidden rounded" style={{ width: '100%', maxWidth: '720px' }}>
      {/* Bande supérieure */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-600 to-amber-400 text-white px-6 py-3 flex justify-between items-center">
        <div className="font-bold text-base tracking-wider uppercase">Lettre de Change</div>
        <div className="text-right text-xs">
          <div className="text-amber-200">Fait à</div>
          <div className="font-bold">{traite.ville || '______'}, le {formatDateLong(traite.date)}</div>
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="text-[10px] text-gray-400 text-center italic border-b border-gray-200 pb-2">
          Conformément aux articles 269 à 338 du Code de Commerce Tunisien
        </div>

        {/* Bordereau */}
        <div className="text-xs text-gray-600">
          <span>BORDEREAU DE COMPTES COURANTS N° </span>
          <span className="border-b border-dashed border-gray-400 inline-block min-w-[150px] font-mono">{traite.remise || '________'}</span>
        </div>

        {/* Tiré */}
        <div className="text-xs">
          <span className="text-gray-500">Tiré à l'ordre de </span>
          <span className="font-bold text-gray-900 border-b-2 border-gray-300 inline-block min-w-[250px]">{traite.tiree || '____________________________'}</span>
        </div>

        {traite.adresseTiree && (
          <div className="text-[11px] text-gray-500 ml-4">{traite.adresseTiree}</div>
        )}

        {/* Échéance + Lieu */}
        <div className="text-xs">
          <span className="text-gray-500">À payer le </span>
          <span className="font-bold text-gray-900 border-b-2 border-gray-300 inline-block min-w-[150px]">{traite.dateEcheance ? formatDateLong(traite.dateEcheance) : '__________________'}</span>
          <span className="text-gray-500"> au domicile de </span>
          <span className="font-bold text-gray-900 border-b-2 border-gray-300 inline-block min-w-[120px]">{traite.lieuPaiement || '____________'}</span>
        </div>

        {/* Somme de */}
        <div className="text-xs">
          <div className="text-gray-500 mb-1">La somme de</div>
          <div className="border-b-2 border-gray-300 font-semibold text-gray-800 py-1 italic min-h-[24px]">
            {montantLettres ? montantLettres + ' *******' : '____________________________________________________'}
          </div>
        </div>

        {/* Montant */}
        <div className="flex justify-end">
          <div className="border-2 border-amber-700 rounded-lg px-5 py-2 bg-amber-50">
            <div className="text-[9px] text-gray-500 text-center uppercase tracking-wide">Montant</div>
            <div className="font-mono text-2xl font-bold text-amber-800 leading-tight">
              {traite.montantChiffres ? parseFloat(traite.montantChiffres).toFixed(3) : '__.___'}
            </div>
            <div className="text-[9px] text-gray-500 text-center">DT (Dinars Tunisiens)</div>
          </div>
        </div>

        {/* Tireur + Bénéficiaire */}
        <div className="grid grid-cols-2 gap-8 pt-2">
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1">Tireur (Créancier)</div>
            <div className="border-b-2 border-gray-300 font-semibold text-xs py-1 min-h-[24px]">{traite.tireur || '________________________'}</div>
            {traite.adresseTireur && <div className="text-[10px] text-gray-500 mt-0.5">{traite.adresseTireur}</div>}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1">Bénéficiaire (Porteur)</div>
            <div className="border-b-2 border-gray-300 font-semibold text-xs py-1 min-h-[24px]">{traite.beneficiaire || '________________________'}</div>
          </div>
        </div>

        {/* Signature */}
        <div className="flex justify-between items-end pt-4">
          <div className="text-[10px] text-gray-400 italic">Signature du tireur</div>
          <div className="w-52 border-b-2 border-gray-300"></div>
        </div>
      </div>
    </div>
  )
}
