import { useState, useCallback, useMemo } from 'react'
import { FaPrint, FaCheck, FaFileInvoice, FaExchangeAlt, FaHistory, FaFileExcel, FaEye, FaBuilding, FaUser, FaCog, FaPlus, FaTrash, FaFolderOpen } from 'react-icons/fa'

const RE_ARA = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

function estArabe(t: string): boolean {
  return RE_ARA.test(t)
}

function detectDirection(t: string): 'ltr' | 'rtl' {
  return estArabe(t) ? 'rtl' : 'ltr'
}

const UN_AR = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const TENS_AR = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const HUND_AR = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

function moins1000Ar(n: number): string {
  let s = ''
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h) s = HUND_AR[h]
  if (r) {
    if (s) s += ' و'
    if (r < 20) s += UN_AR[r]
    else { const d = Math.floor(r / 10), u = r % 10; s += (u ? UN_AR[u] + ' و' : '') + TENS_AR[d] }
  }
  return s
}

function montantEnLettresArabes(montant: number): string {
  if (montant === 0) return ''
  const dinars = Math.floor(montant)
  const millimes = Math.round((montant - dinars) * 1000)
  function partie(n: number, sg: string, dl: string, pl: string): string {
    if (n === 1) return sg
    if (n === 2) return dl
    const w = n <= 10 ? pl : sg
    return moins1000Ar(n) + ' ' + w
  }
  let n = dinars
  const parts: string[] = []
  if (n >= 1e9) return 'مبلغ كبير'
  if (n >= 1e6) { const q = Math.floor(n / 1e6); n %= 1e6; parts.push(partie(q, 'مليون', 'مليونان', 'ملايين')) }
  if (n >= 1e3) { const q = Math.floor(n / 1e3); n %= 1e3; parts.push(partie(q, 'ألف', 'ألفان', 'آلاف')) }
  if (n > 0) parts.push(moins1000Ar(n))
  const dinarPart = dinars > 0 ? (dinars === 1 ? 'دينار واحد' : dinars === 2 ? 'ديناران' : parts.join(' و') + ' ' + (dinars <= 10 ? 'دنانير' : 'دينار')) : ''
  const millPart = millimes > 0 ? (millimes === 1 ? 'مليم واحد' : millimes === 2 ? 'مليمان' : moins1000Ar(millimes) + ' ' + (millimes <= 10 ? 'ملايم' : 'مليم')) : ''
  return [dinarPart, millPart].filter(Boolean).join(' و')
}

function imprimerHTML(html: string) {
  const win = window.open('', '_blank', 'width=900,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Impression</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:176mm 80mm;margin:0;}html,body{width:176mm;height:80mm;margin:0;padding:0;background:white;font-family:Arial,sans-serif;}body{display:flex;align-items:flex-start;justify-content:flex-start;}.cheque{width:176mm;height:80mm;margin:0;flex:none;}</style>
    </head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}

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

function montantEnLettres(montant: number): string {
  if (montant === 0) return ''
  const u = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf']
  const t = ['Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-sept', 'Dix-huit', 'Dix-neuf']
  const d = ['', 'Dix', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-dix', 'Quatre-vingts', 'Quatre-vingt-dix']
  function c(n: number): string {
    if (n === 0) return ''
    if (n < 10) return u[n]
    if (n < 20) return t[n - 10]
    if (n < 100) {
      const x = Math.floor(n / 10), y = n % 10
      if (x === 7) return y === 1 ? 'Soixante-et-onze' : 'Soixante-' + t[y].toLowerCase()
      if (x === 9) return 'Quatre-vingt-' + t[y].toLowerCase()
      if (x === 8) return y === 0 ? 'Quatre-vingts' : 'Quatre-vingt' + '-' + u[y].toLowerCase()
      return d[x] + (y ? (y === 1 ? '-et-un' : '-' + u[y].toLowerCase()) : '')
    }
    if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; const cent = h === 1 ? 'Cent' : u[h] + ' cent' + (r === 0 ? 's' : ''); return cent + (r ? ' ' + c(r) : '') }
    if (n < 1000000) { const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? 'Mille' : c(m) + ' Mille') + (r ? ' ' + c(r) : '') }
    return String(n)
  }
  const dh = Math.floor(montant), ml = Math.round((montant - dh) * 1000)
  return c(dh) + (dh > 1 ? ' Dinars' : ' Dinar') + (ml > 0 ? ' ' + c(ml) + (ml > 1 ? ' Millimes' : ' Millime') : '')
}

function couperLignes(t: string): [string, string] {
  const mots = t.trim().split(/\s+/)
  let l1 = ''
  let l2 = ''
  let onL1 = true
  for (const m of mots) {
    if (onL1 && l1 && (l1 + ' ' + m).length > 56) { l2 = m; onL1 = false; continue }
    if (onL1) l1 = l1 ? l1 + ' ' + m : m
    else l2 = l2 ? l2 + ' ' + m : m
  }
  return [l1, l2 || '……………………………']
}

function formatDateLong(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface CompteForm {
  id: string
  titulaire: string
  numeroCompte: string
  iban: string
  adresse: string
  ville: string
  agence: string
  banqueCode: string
  telephone: string
}

interface ChequeForm {
  date: string
  beneficiaire: string
  montantChiffres: string
  numeroCheque: string
  lieuEmission: string
  bare: boolean
  langue: 'fr' | 'ar'
}

interface TraiteForm {
  date: string
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

interface HistoriqueItem {
  id: number
  type: 'cheque' | 'traite'
  date: string
  beneficiaire: string
  montant: string
  banque?: string
  numeroCheque?: string
}

function loadComptes(): CompteForm[] {
  try { const s = localStorage.getItem('imprimcheques-comptes'); return s ? JSON.parse(s) : [] } catch { return [] }
}

function saveComptes(list: CompteForm[]) {
  localStorage.setItem('imprimcheques-comptes', JSON.stringify(list))
}

function loadHistorique(): HistoriqueItem[] {
  try { const s = localStorage.getItem('imprimcheques-hist'); return s ? JSON.parse(s) : [] } catch { return [] }
}

function saveHistorique(list: HistoriqueItem[]) {
  localStorage.setItem('imprimcheques-hist', JSON.stringify(list))
}

export default function App() {
  const [comptes, setComptes] = useState<CompteForm[]>(loadComptes)
  const [compteSelectionne, setCompteSelectionne] = useState<CompteForm | null>(null)
  const [showCreation, setShowCreation] = useState(false)

  if (compteSelectionne) {
    return <AppPrincipal
      compte={compteSelectionne}
      onBack={() => setCompteSelectionne(null)}
    />
  }

  if (showCreation) {
    return <PageCreationCompte
      onCreated={(c) => {
        const list = [...comptes, c]
        setComptes(list)
        saveComptes(list)
        setShowCreation(false)
        setCompteSelectionne(c)
      }}
      onBack={() => setShowCreation(false)}
    />
  }

  return <PageAccueil
    comptes={comptes}
    onSelect={(c) => setCompteSelectionne(c)}
    onNew={() => setShowCreation(true)}
    onDelete={(id) => {
      const list = comptes.filter(c => c.id !== id)
      setComptes(list)
      saveComptes(list)
    }}
  />
}

function PageAccueil({ comptes, onSelect, onNew, onDelete }: {
  comptes: CompteForm[]
  onSelect: (c: CompteForm) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 text-center">
          <FaBuilding className="text-4xl mx-auto mb-3 opacity-80" />
          <h1 className="text-2xl font-bold">ImprimCheques</h1>
          <p className="text-blue-200 text-sm mt-1">Sélectionnez un compte ou créez-en un nouveau</p>
        </div>

        <div className="p-6">
          <button onClick={onNew}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-green-700 transition mb-4">
            <FaPlus /> Nouveau compte
          </button>

          {comptes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FaFolderOpen className="text-4xl mx-auto mb-3 opacity-30" />
              <p>Aucun compte enregistré</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {comptes.map(c => {
                const b = BANQUES.find(b => b.code === c.banqueCode)
                return (
                  <div key={c.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition cursor-pointer flex items-center justify-between group"
                    onClick={() => onSelect(c)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FaUser className="text-blue-600" />
                        <span className="font-bold text-sm text-gray-800">{c.titulaire}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">{b?.abbr}</span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">N° {c.numeroCompte} | Agence {c.agence}</div>
                      <div className="text-xs text-gray-400">{c.adresse} - {c.ville}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ce compte ?')) onDelete(c.id) }}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-2 transition">
                      <FaTrash />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PageCreationCompte({ onCreated, onBack }: { onCreated: (c: CompteForm) => void; onBack: () => void }) {
  const [form, setForm] = useState<Omit<CompteForm, 'id'>>({
    titulaire: '',
    numeroCompte: '',
    iban: '',
    adresse: '',
    ville: '',
    agence: '',
    banqueCode: '05',
    telephone: '',
  })

  const handle = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  const handleSubmit = () => {
    if (!form.titulaire || !form.numeroCompte) return
    onCreated({ ...form, id: Date.now().toString() })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 text-center">
          <FaBuilding className="text-4xl mx-auto mb-3 opacity-80" />
          <h1 className="text-2xl font-bold">Nouveau Compte</h1>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom du titulaire du chéquier *</label>
            <input type="text" name="titulaire" value={form.titulaire} onChange={handle} dir={detectDirection(form.titulaire)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition"
              placeholder="Nom et prénom du titulaire" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">N° Compte (RIB) - 20 chiffres *</label>
            <input type="text" name="numeroCompte" value={form.numeroCompte} onChange={handle}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none transition"
              placeholder="01000123456789012345" maxLength={20} />
            <p className="text-[9px] text-gray-400 mt-1">Code banque (2) + Agence (3) + Compte (13) + Clé (2) = 20 chiffres</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">IBAN</label>
            <input type="text" name="iban" value={form.iban} onChange={handle}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none transition"
              placeholder="TN59 0100 0012 3456 7890 1234" maxLength={24} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Banque *</label>
            <select name="banqueCode" value={form.banqueCode} onChange={handle}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition">
              {BANQUES.map(b => <option key={b.code} value={b.code}>[{b.code}] {b.abbr} - {b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">N° Agence (B.P.D)</label>
            <input type="text" name="agence" value={form.agence} onChange={handle}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none transition"
              placeholder="001" maxLength={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse</label>
              <input type="text" name="adresse" value={form.adresse} onChange={handle} dir={detectDirection(form.adresse)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition"
                placeholder="Adresse" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ville</label>
              <input type="text" name="ville" value={form.ville} onChange={handle} dir={detectDirection(form.ville)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition"
                placeholder="Ville" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
            <input type="text" name="telephone" value={form.telephone} onChange={handle}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition"
              placeholder="71 000 000" />
          </div>
          <div className="flex gap-3">
            <button onClick={onBack}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold text-sm hover:bg-gray-300 transition">
              Annuler
            </button>
            <button onClick={handleSubmit}
              disabled={!form.titulaire || !form.numeroCompte}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
              Créer & Ouvrir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppPrincipal({ compte, onBack }: { compte: CompteForm; onBack: () => void }) {
  const [page, setPage] = useState<'cheque' | 'traite' | 'historique'>('cheque')
  const [showApercu, setShowApercu] = useState(false)

  const [cheque, setCheque] = useState<ChequeForm>({
    date: new Date().toISOString().split('T')[0],
    beneficiaire: '',
    montantChiffres: '',
    numeroCheque: '',
    lieuEmission: '',
    bare: true,
    langue: 'fr',
  })

  const [traite, setTraite] = useState<TraiteForm>({
    date: new Date().toISOString().split('T')[0],
    tireur: compte.titulaire,
    adresseTireur: compte.adresse,
    tiree: '',
    adresseTiree: '',
    beneficiaire: '',
    montantChiffres: '',
    dateEcheance: '',
    lieuPaiement: compte.ville || 'Tunis',
    remise: '',
  })

  const [historique, setHistorique] = useState<HistoriqueItem[]>(loadHistorique)

  const handleCheque = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCheque(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  const handleTraite = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setTraite(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  const banqueChoisie = useMemo(() => BANQUES.find(b => b.code === compte.banqueCode), [compte.banqueCode])
  const rtlCheque = cheque.langue === 'ar'
  const mlCheque = useMemo(() => montantEnLettres(parseFloat(cheque.montantChiffres) || 0), [cheque.montantChiffres])
  const mlChequeFinal = useMemo(() => (rtlCheque ? montantEnLettresArabes(parseFloat(cheque.montantChiffres) || 0) : mlCheque), [rtlCheque, mlCheque, cheque.montantChiffres])
  const mlTraite = useMemo(() => montantEnLettres(parseFloat(traite.montantChiffres) || 0), [traite.montantChiffres])

  const saveCheque = useCallback(() => {
    if (!cheque.beneficiaire || !cheque.montantChiffres) return
    const item: HistoriqueItem = { id: Date.now(), type: 'cheque', date: cheque.date, beneficiaire: cheque.beneficiaire, montant: cheque.montantChiffres, banque: banqueChoisie?.nom, numeroCheque: cheque.numeroCheque }
    const list = [item, ...historique]
    setHistorique(list)
    saveHistorique(list)
    setShowApercu(true)
  }, [cheque, banqueChoisie, historique])

  const saveTraite = useCallback(() => {
    if (!traite.beneficiaire || !traite.montantChiffres) return
    const item: HistoriqueItem = { id: Date.now(), type: 'traite', date: traite.date, beneficiaire: traite.beneficiaire, montant: traite.montantChiffres }
    const list = [item, ...historique]
    setHistorique(list)
    saveHistorique(list)
    setShowApercu(true)
  }, [traite, historique])

  const delHist = useCallback((id: number) => {
    const list = historique.filter(h => h.id !== id)
    setHistorique(list)
    saveHistorique(list)
  }, [historique])

  const clearHist = useCallback(() => { setHistorique([]); localStorage.removeItem('imprimcheques-hist') }, [])

  const exportCSV = useCallback(() => {
    const h = ['Type', 'Date', 'Bénéficiaire', 'Montant (DT)', 'Banque', 'N° Chèque']
    const rows = historique.map(x => [x.type === 'cheque' ? 'Chèque' : 'Traite', x.date, x.beneficiaire, x.montant, x.banque || '-', x.numeroCheque || '-'])
    const csv = [h, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `imprimcheques-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }, [historique])

  const printCheque = useCallback(() => {
    const html = getChequePrintHTML(cheque, compte, banqueChoisie, mlChequeFinal, rtlCheque)
    imprimerHTML(html)
    setCheque({ date: new Date().toLocaleDateString('fr-FR'), beneficiaire: '', montantChiffres: '', numeroCheque: '', lieuEmission: '', bare: true, langue: 'fr' })
  }, [cheque, compte, banqueChoisie, mlChequeFinal, rtlCheque])

  const printTraite = useCallback(() => {
    const m = traite.montantChiffres ? parseFloat(traite.montantChiffres).toFixed(3) : '__.___'
    const ml = mlTraite ? mlTraite + ' *******' : '____________________________________________________'
    const html = `<div style="width:700px;margin:20px auto;border:2px solid #333;border-radius:4px;font-family:Arial,sans-serif;">
      <div style="background:linear-gradient(135deg,#78350f,#b45309,#f59e0b);color:white;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #78350f;">
        <div style="font-weight:bold;font-size:17px;text-transform:uppercase;letter-spacing:3px;">LETTRE DE CHANGE</div>
        <div style="text-align:right;font-size:12px;"><div style="color:#fde68a;">Fait à</div><div style="font-weight:bold;">${traite.lieuPaiement}, le ${formatDateLong(traite.date)}</div></div>
      </div>
      <div style="padding:20px 28px;">
        <div style="font-size:10px;color:#999;text-align:center;font-style:italic;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:12px;">Conformément aux articles 269 à 338 du Code de Commerce Tunisien</div>
        <div style="font-size:12px;color:#666;margin-bottom:10px;">BORDEREAU N° <span style="border-bottom:1px dashed #999;padding:0 12px;font-family:monospace;">${traite.remise||'________'}</span></div>
        <div style="font-size:13px;margin-bottom:6px;"><span style="color:#888;">Tiré à l'ordre de </span><b style="border-bottom:2px solid #333;padding:0 8px;">${traite.tiree||'____________________________'}</b></div>
        ${traite.adresseTiree?`<div style="font-size:11px;color:#888;margin:0 0 6px 16px;">${traite.adresseTiree}</div>`:''}
        <div style="font-size:13px;margin-bottom:10px;"><span style="color:#888;">À payer le </span><b style="border-bottom:2px solid #333;padding:0 8px;">${traite.dateEcheance?formatDateLong(traite.dateEcheance):'__________________'}</b><span style="color:#888;"> au domicile de </span><b style="border-bottom:2px solid #333;padding:0 8px;">${traite.lieuPaiement||'____________'}</b></div>
        <div style="font-size:13px;margin-bottom:6px;"><span style="color:#888;">La somme de</span></div>
        <div style="border-bottom:2px solid #333;font-weight:600;font-style:italic;font-size:14px;padding:6px 0;color:#222;margin-bottom:16px;min-height:24px;">${ml}</div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
          <div style="border:2px solid #78350f;border-radius:8px;padding:8px 24px;background:#fffbeb;text-align:center;">
            <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;">MONTANT</div>
            <div style="font-family:monospace;font-size:28px;font-weight:bold;color:#78350f;line-height:1.2;">${m}</div>
            <div style="font-size:10px;color:#666;">DINARS TUNISIENS</div>
          </div>
        </div>
        <div style="display:flex;gap:40px;border-top:1px solid #ddd;padding-top:12px;">
          <div style="flex:1;"><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Tireur (Créancier)</div><div style="border-bottom:2px solid #333;font-weight:600;font-size:13px;padding:4px 0;">${traite.tireur||'________________________'}</div>${traite.adresseTireur?`<div style="font-size:10px;color:#888;margin-top:2px;">${traite.adresseTireur}</div>`:''}</div>
          <div style="flex:1;"><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Bénéficiaire (Porteur)</div><div style="border-bottom:2px solid #333;font-weight:600;font-size:13px;padding:4px 0;">${traite.beneficiaire||'________________________'}</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;"><div style="text-align:right;"><div style="font-size:9px;color:#aaa;margin-bottom:4px;">Signature du tireur</div><div style="width:180px;border-bottom:1px solid #999;"></div></div></div>
      </div>
    </div>`
    imprimerHTML(html)
  }, [traite, mlTraite])

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg"><FaExchangeAlt className="text-xl" /></div>
            <div>
              <h1 className="text-2xl font-bold">ImprimCheques</h1>
              <p className="text-blue-200 text-xs">{compte.titulaire} | {banqueChoisie?.abbr} | N° {compte.numeroCompte}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage('cheque')} className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 transition ${page === 'cheque' ? 'bg-white text-blue-900' : 'bg-white/10 hover:bg-white/20'}`}><FaCheck /> Chèque</button>
            <button onClick={() => setPage('traite')} className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 transition ${page === 'traite' ? 'bg-white text-amber-900' : 'bg-white/10 hover:bg-white/20'}`}><FaFileInvoice /> Traite</button>
            <button onClick={() => setPage('historique')} className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 transition ${page === 'historique' ? 'bg-white text-green-900' : 'bg-white/10 hover:bg-white/20'}`}><FaHistory /> Historique ({historique.length})</button>
            <button onClick={onBack} className="px-3 py-2 rounded text-sm font-semibold bg-white/10 hover:bg-red-500/80 transition flex items-center gap-1.5"><FaCog /> Comptes</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {page === 'cheque' && (
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className="lg:w-[420px] space-y-4">
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FaCheck className="text-blue-600" /> Nouveau Chèque</h2>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
                  <p className="text-[10px] font-bold text-blue-700 uppercase">Mon Compte</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div><span className="text-gray-500">Titulaire : </span><span className="font-bold">{compte.titulaire}</span></div>
                    <div><span className="text-gray-500">Banque : </span><span className="font-bold">{banqueChoisie?.abbr}</span></div>
                    <div><span className="text-gray-500">N° Compte : </span><span className="font-mono font-bold">{compte.numeroCompte}</span></div>
                    <div><span className="text-gray-500">Agence : </span><span className="font-mono font-bold">{compte.agence}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">IBAN : </span><span className="font-mono font-bold text-[11px]">{compte.iban || '-'}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ville (lieu d'émission)</label><input type="text" name="lieuEmission" value={cheque.lieuEmission} onChange={handleCheque} dir={detectDirection(cheque.lieuEmission)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Sousse" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date émission</label><input type="date" name="date" value={cheque.date} onChange={handleCheque} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">N° Chèque (pour historique)</label><input type="text" name="numeroCheque" value={cheque.numeroCheque} onChange={handleCheque} className="w-full border rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="00123456" /></div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Langue du chèque</label>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button onClick={() => setCheque(prev => ({ ...prev, langue: 'fr' }))} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${cheque.langue === 'fr' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>Français</button>
                    <button onClick={() => setCheque(prev => ({ ...prev, langue: 'ar' }))} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${cheque.langue === 'ar' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`} dir="rtl">العربية</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="bare" checked={cheque.bare} onChange={(e) => setCheque(prev => ({ ...prev, bare: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                  <label className="text-xs font-semibold text-gray-600">Chèque barré (non endossable)</label>
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Bénéficiaire (A l'ordre de)</label><input type="text" name="beneficiaire" value={cheque.beneficiaire} onChange={handleCheque} dir={detectDirection(cheque.beneficiaire)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Nom du bénéficiaire" /></div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Montant (DT) - Plafond 30 000 DT</label>
                  <input type="number" step="0.001" min="0" max="30000" name="montantChiffres" value={cheque.montantChiffres} onChange={handleCheque} className="w-full border rounded px-3 py-1.5 text-sm font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0.000" />
                  <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded">
                    <span className="text-[10px] text-blue-600 font-semibold uppercase">En lettres : </span>
                    <span dir={detectDirection(mlChequeFinal)} className="text-sm text-blue-800 font-bold italic">{mlChequeFinal || 'Saisissez le montant'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowApercu(true)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow"><FaEye /> Aperçu</button>
                <button onClick={saveCheque} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow"><FaPrint /> Enregistrer & Imprimer</button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Aperçu</h2>
              <ApercuCheque cheque={cheque} compte={compte} banque={banqueChoisie} ml={mlChequeFinal} rtl={rtlCheque} />
            </div>
          </div>
        )}

        {page === 'traite' && (
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className="lg:w-[400px] space-y-4">
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FaFileInvoice className="text-amber-600" /> Nouvelle Traite</h2>
                <p className="text-[11px] text-gray-500 italic">Art. 269-338 Code Commerce Tunisien</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date</label><input type="date" name="date" value={traite.date} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Lieu</label><input type="text" name="lieuPaiement" value={traite.lieuPaiement} onChange={handleTraite} dir={detectDirection(traite.lieuPaiement)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">Tireur (Créancier)</p>
                  <input type="text" name="tireur" value={traite.tireur} onChange={handleTraite} dir={detectDirection(traite.tireur)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Nom du tireur" />
                  <input type="text" name="adresseTireur" value={traite.adresseTireur} onChange={handleTraite} dir={detectDirection(traite.adresseTireur)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Adresse" />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                  <p className="text-[10px] font-bold text-blue-800 uppercase">Tiré (Débiteur)</p>
                  <input type="text" name="tiree" value={traite.tiree} onChange={handleTraite} dir={detectDirection(traite.tiree)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Nom du tiré" />
                  <input type="text" name="adresseTiree" value={traite.adresseTiree} onChange={handleTraite} dir={detectDirection(traite.adresseTiree)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Adresse" />
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Bénéficiaire (Porteur)</label><input type="text" name="beneficiaire" value={traite.beneficiaire} onChange={handleTraite} dir={detectDirection(traite.beneficiaire)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Nom du bénéficiaire" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Échéance</label><input type="date" name="dateEcheance" value={traite.dateEcheance} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Remise / Réf.</label><input type="text" name="remise" value={traite.remise} onChange={handleTraite} dir={detectDirection(traite.remise)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="N° facture" /></div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Montant (DT)</label>
                  <input type="number" step="0.001" min="0" name="montantChiffres" value={traite.montantChiffres} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm font-mono text-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="0.000" />
                  <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded">
                    <span className="text-[10px] text-amber-600 font-semibold uppercase">En lettres : </span>
                    <span className="text-sm text-amber-800 font-bold italic">{mlTraite || 'Saisissez le montant'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowApercu(true)} className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition shadow"><FaEye /> Aperçu</button>
                <button onClick={saveTraite} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow"><FaPrint /> Enregistrer & Imprimer</button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Aperçu</h2>
              <ApercuTraite traite={traite} ml={mlTraite} />
            </div>
          </div>
        )}

        {page === 'historique' && <PageHistorique historique={historique} onDel={delHist} onClear={clearHist} onExport={exportCSV} />}
      </div>

      {showApercu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApercu(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Aperçu avant impression</h3>
              <div className="flex gap-2">
                <button onClick={() => page === 'traite' ? printTraite() : printCheque()} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"><FaPrint /> Imprimer</button>
                <button onClick={() => setShowApercu(false)} className="bg-gray-200 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300">Fermer</button>
              </div>
            </div>
            {page === 'cheque' || page === 'historique' ? <ApercuCheque cheque={cheque} compte={compte} banque={banqueChoisie} ml={mlChequeFinal} rtl={rtlCheque} /> : <ApercuTraite traite={traite} ml={mlTraite} />}
          </div>
        </div>
      )}
    </div>
  )
}

function ApercuCheque({ cheque, compte, banque, ml, rtl }: { cheque: ChequeForm; compte: CompteForm; banque: typeof BANQUES[0] | undefined; ml: string; rtl: boolean }) {
  const prefMontant = rtl ? 'ادفعوا بمقتضى هذا الشيك غير القابل للتظهير :' : 'Payez contre ce chèque non endossable :'
  const libOrdre = rtl ? 'لأمر :' : "A l'ordre de :"
  const libVille = rtl ? 'البلدة :' : 'Ville :'
  const libDate = rtl ? 'التاريخ :' : 'Date :'
  const espace = rtl ? { right: '10mm', left: '8mm', direction: 'rtl' as const } : { left: '8mm', right: '8mm' }
  const mlText = ml ? ml : '……………………………'
  const m = cheque.montantChiffres ? parseFloat(cheque.montantChiffres).toFixed(3) : '__.___'
  const [ligne1, ligne2] = couperLignes(mlText)

  return (
    <div style={{ width: '176mm', height: '80mm', fontFamily: 'Arial, sans-serif', border: '1px solid #999', overflow: 'hidden', position: 'relative', background: 'white', fontSize: '9px' }}>

      {/* 2 barres parallèles (chèque barré) - coin haut gauche */}
      {cheque.bare && (
        <div style={{ position: 'absolute', top: '2mm', left: '3mm', width: '8mm', height: '6mm' }}>
          <div style={{ position: 'absolute', top: '1mm', left: 0, width: '100%', height: 0, borderTop: '0.5mm solid #333', transform: 'rotate(-20deg)', transformOrigin: 'left center' }}></div>
          <div style={{ position: 'absolute', top: '3mm', left: 0, width: '100%', height: 0, borderTop: '0.5mm solid #333', transform: 'rotate(-20deg)', transformOrigin: 'left center' }}></div>
        </div>
      )}

      {/* ===== EN-TÊTE BANQUE (haut gauche, X 5-75 / Y 5-15) ===== */}
      <div style={{ position: 'absolute', top: '5mm', left: '8mm', right: '78mm', fontSize: '4mm', color: '#16336b', fontWeight: 'bold', lineHeight: 1.2 }}>
        {banque?.nom || 'Banque Zitouna'}
      </div>

      {/* ===== N° CHÈQUE (à côté de la case montant) ===== */}
      <div style={{ position: 'absolute', top: '6mm', left: '90mm', width: '31mm', textAlign: 'right' }}>
        <div style={{ fontSize: '2mm', color: '#777' }}>N° chèque :</div>
        <div style={{ fontSize: '3mm', fontFamily: 'monospace', fontWeight: 'bold', color: '#222' }}>{cheque.numeroCheque || '…………'}</div>
      </div>

      {/* ===== MONTANT EN CHIFFRES (sans cadre, tout en haut à droite) ===== */}
      <div style={{ position: 'absolute', top: '0mm', right: '4mm', textAlign: 'right' }}>
        <div style={{ fontSize: '1.8mm', color: '#777' }}>B.P.D</div>
        <div style={{ fontSize: '4.5mm', fontFamily: 'monospace', fontWeight: 'bold', color: '#c00' }}>{m} DT</div>
      </div>

      {/* ===== MONTANT EN LETTRES (Payez contre + texte + points même ligne) ===== */}
      {/* Ligne 1 (25mm) : texte au début, points après, direction auto G->D / D->G */}
      <div style={{ position: 'absolute', top: '25mm', display: 'flex', alignItems: 'flex-start', ...espace }}>
        <span style={{ fontSize: '2.5mm', color: '#555', fontStyle: rtl ? 'normal' : 'italic', marginRight: '2mm', whiteSpace: 'nowrap', flexShrink: 0 }}>{prefMontant}</span>
        <span style={{ fontSize: '3.5mm', fontWeight: 'bold', color: '#222', whiteSpace: 'normal', wordBreak: 'break-word', flex: '0 1 auto', minWidth: 0 }}>{ligne1}</span>
        <span style={{ flex: 1, borderBottom: '0.4mm dotted #999', height: '4mm', marginLeft: '2mm', minWidth: '5mm' }}></span>
      </div>
      {/* Ligne 2 (30mm) - texte + points */}
      <div style={{ position: 'absolute', top: '30mm', display: 'flex', alignItems: 'flex-start', ...espace }}>
        <span style={{ fontSize: '3.5mm', fontWeight: 'bold', color: '#222', whiteSpace: 'normal', wordBreak: 'break-word', flex: '0 1 auto', minWidth: 0 }}>{ligne2}</span>
        <span style={{ flex: 1, borderBottom: '0.4mm dotted #999', height: '4mm', marginLeft: '2mm', minWidth: '5mm' }}></span>
      </div>

      {/* ===== A L'ORDRE DE (35mm, reculé, points jusqu'au bout) ===== */}
      <div style={{ position: 'absolute', top: '35mm', display: 'flex', alignItems: 'flex-start', ...espace }}>
        <span style={{ fontSize: '2.5mm', fontWeight: 'bold', color: '#333', marginRight: '2mm', flexShrink: 0 }}>{libOrdre}</span>
        <span dir={detectDirection(cheque.beneficiaire)} style={{ fontSize: '3.5mm', fontWeight: 'bold', color: '#222', whiteSpace: 'normal', wordBreak: 'break-word', flex: '0 1 auto', minWidth: 0 }}>{cheque.beneficiaire || '………………………………'}</span>
        <span style={{ flex: 1, borderBottom: '0.4mm dotted #999', height: '3.5mm', marginLeft: '2mm', minWidth: '5mm' }}></span>
      </div>

      {/* ===== SIGNATURE (droite, à 46mm, même position dans les 2 langues) ===== */}
      <div style={{ position: 'absolute', top: '46mm', left: '122mm', width: '44mm', textAlign: 'center', fontSize: '2mm', color: '#777' }}>
        <div>Signature(s)</div>
        <div style={{ borderBottom: '0.4mm dotted #999', width: '80%', margin: '1.5mm auto 0' }}></div>
      </div>

      {/* ===== LIGNE BAS (AGENCE gauche / N° compte au milieu, à 43mm) ===== */}
      <div style={{ position: 'absolute', top: '43mm', left: '8mm', right: '8mm', display: 'flex', alignItems: 'center', ...(rtl ? { direction: 'rtl' } : {}) }}>
        {/* A.G.E.N.C.E (gauche) */}
        <div style={{ flex: 1, fontSize: '2mm', color: '#777' }}>
          <div>A.G.E.N.C.E</div>
          <div style={{ fontWeight: 'bold', fontSize: '3mm', color: '#333' }}>{compte.agence || '___'}</div>
        </div>

        {/* N° compte (au milieu exactement) */}
        <div style={{ flex: 1, textAlign: 'center', fontSize: '2mm', color: '#777' }}>
          <div>N° de compte</div>
          <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '3mm', color: '#333', letterSpacing: '0.5mm', marginTop: '0.5mm' }}>{compte.numeroCompte || '………………………………'}</div>
        </div>

        {/* Espaceur symétrique pour garder N° compte centré */}
        <div style={{ flex: 1 }}></div>
      </div>

      {/* ===== VILLE + DATE (à 56mm, toujours au milieu) ===== */}
      <div style={{ position: 'absolute', top: '56mm', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'baseline', gap: '1mm', whiteSpace: 'nowrap', ...(rtl ? { direction: 'rtl' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '2.5mm', color: '#555', marginRight: '1mm' }}>{libVille}</span>
          <span dir={detectDirection(cheque.lieuEmission)} style={{ fontSize: '3mm', fontWeight: 'bold', color: '#222', borderBottom: '0.4mm dotted #999', padding: '0 2mm' }}>{cheque.lieuEmission || '……………'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '2.5mm', color: '#555', marginRight: '1mm' }}>{libDate}</span>
          <span dir="ltr" style={{ fontSize: '3mm', fontWeight: 'bold', color: '#222', borderBottom: '0.4mm dotted #999', padding: '0 2mm' }}>{cheque.date || '…/…/……'}</span>
        </div>
      </div>

      {/* ===== MICR (en bas, ne couvre pas la date) ===== */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: '42mm', background: '#f5f5f5', borderTop: '1px solid #ddd', padding: '1.5mm 12mm', textAlign: 'center', fontFamily: 'monospace', fontSize: '2.5mm', color: '#555', letterSpacing: '1.5mm' }}>
        ⑆{compte.numeroCompte || '………………………………'} ⑆{compte.agence || '……'} ⑆•••
      </div>
    </div>
  )
}

function ApercuTraite({ traite, ml }: { traite: TraiteForm; ml: string }) {
  return (
    <div id="check-preview" className="bg-white border-2 border-gray-400 shadow-xl overflow-hidden rounded" style={{ maxWidth: 700 }}>
      <div style={{ background: 'linear-gradient(135deg,#78350f,#b45309,#f59e0b)' }} className="text-white px-6 py-3 flex justify-between items-center">
        <div className="font-bold text-base tracking-wider uppercase">Lettre de Change</div>
        <div className="text-right text-xs"><div className="text-amber-200">Fait à</div><div className="font-bold">{traite.lieuPaiement}, le {formatDateLong(traite.date)}</div></div>
      </div>
      <div className="p-6 space-y-3">
        <div className="text-[10px] text-gray-400 text-center italic border-b border-gray-200 pb-2">Art. 269-338 Code de Commerce Tunisien</div>
        <div className="text-xs text-gray-600"><span>BORDEREAU N° </span><span className="border-b border-dashed border-gray-400 inline-block min-w-[150px] font-mono">{traite.remise || '________'}</span></div>
        <div className="text-xs"><span className="text-gray-500">Tiré à l'ordre de </span><span className="font-bold text-gray-900 border-b-2 border-gray-300 inline-block min-w-[250px]">{traite.tiree || '____________________________'}</span></div>
        {traite.adresseTiree && <div className="text-[11px] text-gray-500 ml-4">{traite.adresseTiree}</div>}
        <div className="text-xs"><span className="text-gray-500">À payer le </span><span className="font-bold text-gray-900 border-b-2 border-gray-300 inline-block min-w-[150px]">{traite.dateEcheance ? formatDateLong(traite.dateEcheance) : '__________________'}</span><span className="text-gray-500"> au domicile de </span><span className="font-bold text-gray-900 border-b-2 border-gray-300 inline-block min-w-[120px]">{traite.lieuPaiement || '____________'}</span></div>
        <div className="text-xs"><div className="text-gray-500 mb-1">La somme de</div><div className="border-b-2 border-gray-300 font-semibold text-gray-800 py-1 italic min-h-[24px]">{ml ? ml + ' *******' : '____________________________________________________'}</div></div>
        <div className="flex justify-end"><div className="border-2 border-amber-700 rounded-lg px-5 py-2 bg-amber-50 text-center"><div className="text-[9px] text-gray-500 uppercase">Montant</div><div className="font-mono text-2xl font-bold text-amber-800">{traite.montantChiffres ? parseFloat(traite.montantChiffres).toFixed(3) : '__.___'}</div><div className="text-[9px] text-gray-500">DT</div></div></div>
        <div className="grid grid-cols-2 gap-8 pt-2">
          <div><div className="text-[10px] text-gray-500 uppercase mb-1">Tireur</div><div className="border-b-2 border-gray-300 font-semibold text-xs py-1">{traite.tireur || '________________________'}</div>{traite.adresseTireur && <div className="text-[10px] text-gray-500 mt-0.5">{traite.adresseTireur}</div>}</div>
          <div><div className="text-[10px] text-gray-500 uppercase mb-1">Bénéficiaire</div><div className="border-b-2 border-gray-300 font-semibold text-xs py-1">{traite.beneficiaire || '________________________'}</div></div>
        </div>
      </div>
    </div>
  )
}

function PageHistorique({ historique, onDel, onClear, onExport }: { historique: HistoriqueItem[]; onDel: (id: number) => void; onClear: () => void; onExport: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FaHistory /> Historique</h2>
        <div className="flex gap-2">
          <button onClick={onExport} disabled={!historique.length} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-sm"><FaFileExcel /> Exporter Excel</button>
          <button onClick={onClear} disabled={!historique.length} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 text-sm">Tout supprimer</button>
        </div>
      </div>
      {!historique.length ? (
        <div className="text-center py-12 text-gray-400"><FaHistory className="text-4xl mx-auto mb-3 opacity-30" /><p>Aucun élément enregistré.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-100 text-gray-600 text-xs uppercase"><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Bénéficiaire</th><th className="px-3 py-2 text-right">Montant (DT)</th><th className="px-3 py-2 text-left">Banque</th><th className="px-3 py-2 text-left">N° Chèque</th><th className="px-3 py-2 text-center">Barré</th><th className="px-3 py-2 text-center">Actions</th></tr></thead>
            <tbody>{historique.map(h => (
              <tr key={h.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${h.type === 'cheque' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{h.type === 'cheque' ? 'Chèque' : 'Traite'}</span></td>
                <td className="px-3 py-2 text-gray-700">{h.date}</td>
                <td className="px-3 py-2 font-semibold">{h.beneficiaire}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{parseFloat(h.montant).toFixed(3)}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{h.banque || '-'}</td>
                <td className="px-3 py-2 font-mono text-xs">{h.numeroCheque || '-'}</td>
                <td className="px-3 py-2 text-center">{h.type === 'cheque' ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-400">-</span>}</td>
                <td className="px-3 py-2 text-center"><button onClick={() => onDel(h.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="mt-3 text-right text-sm text-gray-500">Total : <b className="text-gray-800">{historique.length}</b> | Montant total : <b className="text-gray-800">{historique.reduce((s, h) => s + parseFloat(h.montant || '0'), 0).toFixed(3)} DT</b></div>
        </div>
      )}
    </div>
  )
}

function getChequePrintHTML(cheque: ChequeForm, _compte: CompteForm, _banque: typeof BANQUES[0] | undefined, ml: string, rtl = false): string {
  const mlText = ml ? ml : '……………………………'
  const m = cheque.montantChiffres ? parseFloat(cheque.montantChiffres).toFixed(3) : '__.___'
  const [ligne1, ligne2] = couperLignes(mlText)
  const prefMontant = rtl ? 'ادفعوا بمقتضى هذا الشيك غير القابل للتظهير :' : 'Payez contre ce chèque non endossable :'
  const libOrdre = rtl ? 'لأمر :' : "A l'ordre de :"
  const libVille = rtl ? 'البلدة :' : 'Ville :'
  const libDate = rtl ? 'التاريخ :' : 'Date :'
  const espace = rtl ? 'right:10mm;left:8mm;direction:rtl;' : 'left:8mm;right:8mm;'
  const villeStyle = rtl ? 'top:56mm;left:50%;transform:translateX(-50%);display:flex;align-items:baseline;gap:1mm;white-space:nowrap;direction:rtl;' : 'top:56mm;left:50%;transform:translateX(-50%);display:flex;align-items:baseline;gap:1mm;white-space:nowrap;'
  const dateStyle = ''
  const milliStyle = rtl ? 'font-style:normal;' : 'font-style:italic;'

  return `<div class="cheque" style="font-family:Arial,sans-serif;overflow:hidden;position:relative;background:transparent;margin:0;font-size:9px;">
    <div style="position:absolute;top:6mm;right:4mm;text-align:right;"><div style="font-size:4.5mm;font-family:monospace;font-weight:bold;color:#c00;">${m} DT</div></div>
    <div style="position:absolute;top:25mm;${espace}display:flex;align-items:flex-start;"><span style="font-size:2.5mm;color:#555;${milliStyle}margin-right:2mm;white-space:nowrap;flex-shrink:0;visibility:hidden;">${prefMontant}</span><span style="font-size:3.5mm;font-weight:bold;color:#222;white-space:normal;word-break:break-word;flex:0 1 auto;min-width:0;">${ligne1}</span></div>
    <div style="position:absolute;top:30mm;${espace}display:flex;align-items:flex-start;"><span style="font-size:3.5mm;font-weight:bold;color:#222;white-space:normal;word-break:break-word;flex:0 1 auto;min-width:0;">${ligne2}</span></div>
    <div style="position:absolute;top:35mm;${espace}display:flex;align-items:flex-start;"><span style="font-size:2.5mm;font-weight:bold;color:#333;margin-right:2mm;flex-shrink:0;visibility:hidden;">${libOrdre}</span><span style="font-size:3.5mm;font-weight:bold;color:#222;white-space:normal;word-break:break-word;flex:0 1 auto;min-width:0;" dir="${detectDirection(cheque.beneficiaire)}">${cheque.beneficiaire || '………………………………'}</span></div>
    <div style="position:absolute;${villeStyle}"><div style="display:flex;align-items:baseline;"><span style="font-size:2.5mm;color:#555;margin-right:1mm;">${libVille}</span><span style="font-size:3mm;font-weight:bold;color:#222;padding:0 2mm;" dir="${detectDirection(cheque.lieuEmission)}">${cheque.lieuEmission || '……………'}</span></div><div style="display:flex;align-items:baseline;${dateStyle}"><span style="font-size:2.5mm;color:#555;margin-right:1mm;">${libDate}</span><span dir="ltr" style="font-size:3mm;font-weight:bold;color:#222;padding:0 2mm;">${cheque.date || '…/…/……'}</span></div></div>
  </div>`
}
