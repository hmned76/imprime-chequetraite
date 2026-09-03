import { useState, useCallback, useMemo } from 'react'
import { FaPrint, FaCheck, FaFileInvoice, FaExchangeAlt, FaHistory, FaFileExcel, FaEye, FaBuilding, FaUser, FaCog, FaPlus, FaTrash, FaFolderOpen } from 'react-icons/fa'

const RE_ARA = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

function estArabe(t: string): boolean {
  return RE_ARA.test(t)
}

function detectDirection(t: string): 'ltr' | 'rtl' {
  return estArabe(t) ? 'rtl' : 'ltr'
}

const UN_AR = ['ØµÙØ±', 'ÙˆØ§Ø­Ø¯', 'Ø§Ø«Ù†Ø§Ù†', 'Ø«Ù„Ø§Ø«Ø©', 'Ø£Ø±Ø¨Ø¹Ø©', 'Ø®Ù…Ø³Ø©', 'Ø³ØªØ©', 'Ø³Ø¨Ø¹Ø©', 'Ø«Ù…Ø§Ù†ÙŠØ©', 'ØªØ³Ø¹Ø©', 'Ø¹Ø´Ø±Ø©', 'Ø£Ø­Ø¯ Ø¹Ø´Ø±', 'Ø§Ø«Ù†Ø§ Ø¹Ø´Ø±', 'Ø«Ù„Ø§Ø«Ø© Ø¹Ø´Ø±', 'Ø£Ø±Ø¨Ø¹Ø© Ø¹Ø´Ø±', 'Ø®Ù…Ø³Ø© Ø¹Ø´Ø±', 'Ø³ØªØ© Ø¹Ø´Ø±', 'Ø³Ø¨Ø¹Ø© Ø¹Ø´Ø±', 'Ø«Ù…Ø§Ù†ÙŠØ© Ø¹Ø´Ø±', 'ØªØ³Ø¹Ø© Ø¹Ø´Ø±']
const TENS_AR = ['', '', 'Ø¹Ø´Ø±ÙˆÙ†', 'Ø«Ù„Ø§Ø«ÙˆÙ†', 'Ø£Ø±Ø¨Ø¹ÙˆÙ†', 'Ø®Ù…Ø³ÙˆÙ†', 'Ø³ØªÙˆÙ†', 'Ø³Ø¨Ø¹ÙˆÙ†', 'Ø«Ù…Ø§Ù†ÙˆÙ†', 'ØªØ³Ø¹ÙˆÙ†']
const HUND_AR = ['', 'Ù…Ø§Ø¦Ø©', 'Ù…Ø§Ø¦ØªØ§Ù†', 'Ø«Ù„Ø§Ø«Ù…Ø§Ø¦Ø©', 'Ø£Ø±Ø¨Ø¹Ù…Ø§Ø¦Ø©', 'Ø®Ù…Ø³Ù…Ø§Ø¦Ø©', 'Ø³ØªÙ…Ø§Ø¦Ø©', 'Ø³Ø¨Ø¹Ù…Ø§Ø¦Ø©', 'Ø«Ù…Ø§Ù†Ù…Ø§Ø¦Ø©', 'ØªØ³Ø¹Ù…Ø§Ø¦Ø©']

function moins1000Ar(n: number): string {
  let s = ''
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h) s = HUND_AR[h]
  if (r) {
    if (s) s += ' Ùˆ'
    if (r < 20) s += UN_AR[r]
    else { const d = Math.floor(r / 10), u = r % 10; s += (u ? UN_AR[u] + ' Ùˆ' : '') + TENS_AR[d] }
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
  if (n >= 1e9) return 'Ù…Ø¨Ù„Øº ÙƒØ¨ÙŠØ±'
  if (n >= 1e6) { const q = Math.floor(n / 1e6); n %= 1e6; parts.push(partie(q, 'Ù…Ù„ÙŠÙˆÙ†', 'Ù…Ù„ÙŠÙˆÙ†Ø§Ù†', 'Ù…Ù„Ø§ÙŠÙŠÙ†')) }
  if (n >= 1e3) { const q = Math.floor(n / 1e3); n %= 1e3; parts.push(partie(q, 'Ø£Ù„Ù', 'Ø£Ù„ÙØ§Ù†', 'Ø¢Ù„Ø§Ù')) }
  if (n > 0) parts.push(moins1000Ar(n))
  const dinarPart = dinars > 0 ? (dinars === 1 ? 'Ø¯ÙŠÙ†Ø§Ø± ÙˆØ§Ø­Ø¯' : dinars === 2 ? 'Ø¯ÙŠÙ†Ø§Ø±Ø§Ù†' : parts.join(' Ùˆ') + ' ' + (dinars <= 10 ? 'Ø¯Ù†Ø§Ù†ÙŠØ±' : 'Ø¯ÙŠÙ†Ø§Ø±')) : ''
  const millPart = millimes > 0 ? (millimes === 1 ? 'Ù…Ù„ÙŠÙ… ÙˆØ§Ø­Ø¯' : millimes === 2 ? 'Ù…Ù„ÙŠÙ…Ø§Ù†' : moins1000Ar(millimes) + ' ' + (millimes <= 10 ? 'Ù…Ù„Ø§ÙŠÙ…' : 'Ù…Ù„ÙŠÙ…')) : ''
  return [dinarPart, millPart].filter(Boolean).join(' Ùˆ')
}

function imprimerHTML(html: string, w = 176, h = 80) {
  const win = window.open('', '_blank', 'width=900,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Impression</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:${w}mm ${h}mm;margin:0;}html,body{width:${w}mm;height:${h}mm;margin:0;padding:0;background:white;font-family:Arial,sans-serif;}body{display:flex;align-items:flex-start;justify-content:flex-start;}.cheque,.traite{width:${w}mm;height:${h}mm;margin:0;flex:none;}</style>
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
  { code: '10', nom: 'SociÃ©tÃ© Tunisienne de Banque', abbr: 'STB' },
  { code: '11', nom: "Union Bancaire pour le Commerce et l'Industrie", abbr: 'UBCI' },
  { code: '12', nom: 'Union Internationale de Banques', abbr: 'UIB' },
  { code: '14', nom: "Banque de l'Habitat", abbr: 'BH' },
  { code: '16', nom: 'Citibank', abbr: 'CITIBANK' },
  { code: '17', nom: 'Office National des Postes', abbr: 'CCP' },
  { code: '20', nom: 'Banque Tuniso-KoweÃ¯tienne', abbr: 'BTK' },
  { code: '21', nom: 'Tunisian Saudi Bank', abbr: 'TSB' },
  { code: '23', nom: 'Qatar National Bank', abbr: 'QNB' },
  { code: '24', nom: 'Banque de Tunisie et des Ã‰mirats', abbr: 'BTE' },
  { code: '25', nom: 'Banque Zitouna', abbr: 'BZ' },
  { code: '26', nom: 'Banque Tuniso-Libyenne', abbr: 'BTL' },
  { code: '27', nom: 'Banque Tunisienne de SolidaritÃ©', abbr: 'BTS' },
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

function couperLignes(t: string, max = 56): [string, string] {
  const mots = t.trim().split(/\s+/)
  let l1 = ''
  let l2 = ''
  let onL1 = true
  for (const m of mots) {
    if (onL1 && l1 && (l1 + ' ' + m).length > max) { l2 = m; onL1 = false; continue }
    if (onL1) l1 = l1 ? l1 + ' ' + m : m
    else l2 = l2 ? l2 + ' ' + m : m
  }
  return [l1, l2 || 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦']
}

function XS(d: string): string {
  if (!d) return ''
  try { return new Intl.DateTimeFormat('en-GB').format(new Date(d)) } catch { return '' }
}

function B1(montant: string): string {
  const e = parseFloat(montant)
  if (isNaN(e)) return montant
  const n = e.toFixed(3)
  const [r, i] = n.split('.')
  return `${r.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${i}`
}

function x8(rib: string): string[] {
  return rib.length !== 20 ? ['', '', '', ''] : [rib.slice(0, 2), rib.slice(2, 5), rib.slice(5, 18), rib.slice(18, 20)]
}

function v8(rib: string): string {
  return rib.replace(/(.{3})/g, '$1 ').trim()
}

const UN_FR = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
const TEENS_FR = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const TENS_FR = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix']

function nbEnFrancais(c: number): string {
  if (c < 10) return UN_FR[c]
  if (c < 20) return TEENS_FR[c - 10]
  let u = Math.floor(c / 10), d = c % 10
  if (c >= 70 && c < 80) return 'soixante' + (d === 1 ? '-et-onze' : '-' + TEENS_FR[d])
  if (c >= 90 && c < 100) return 'quatre-vingt-' + (d === 0 ? 'dix' : TEENS_FR[d])
  let m = TENS_FR[u]
  if (d === 1 && u !== 8) m += ' et ' + UN_FR[d]
  else if (d) m += '-' + UN_FR[d]
  return m
}

function centsEnFrancais(c: number): string {
  if (c < 100) return nbEnFrancais(c)
  let u = Math.floor(c / 100), d = c % 100
  return (u > 1 ? UN_FR[u] + ' cent' : 'cent') + (d ? ' ' + nbEnFrancais(d) : '')
}

function FS(c: number): string {
  if (c === 0) return 'zÃ©ro'
  let u = ''
  if (c >= 1e6) { let d = Math.floor(c / 1e6); u += centsEnFrancais(d) + ' million' + (d > 1 ? 's' : ''); c %= 1e6; if (c) u += ' ' }
  if (c >= 1e3) { let d = Math.floor(c / 1e3); u += (d > 1 ? centsEnFrancais(d) + ' mille' : 'mille'); c %= 1e3; if (c) u += ' ' }
  if (c) u += centsEnFrancais(c)
  return u
}

function montantEnLettresDT(t: number): string {
  let e = t.toString().replace(/\./g, ',')
  const [n, r] = e.split(',').map(a => parseInt(a, 10) || 0)
  let i = FS(n) + ' dinar' + (n !== 1 ? 's' : '')
  if (r > 0) i += ' et ' + FS(r) + ' millime' + (r > 1 ? 's' : '')
  return i
}

let realPngData: string = ''
function imgToDataUrl(): Promise<string> {
  return new Promise<string>((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const c = document.createElement('canvas')
          c.width = img.naturalWidth; c.height = img.naturalHeight
          const ctx = c.getContext('2d')
          if (!ctx) { resolve(''); return }
          ctx.drawImage(img, 0, 0)
          resolve(c.toDataURL('image/png'))
        } catch { resolve('') }
      }
      img.onerror = () => resolve('')
      img.src = './real.png'
    } catch { resolve('') }
  })
}
async function ensureRealPng(): Promise<string> {
  if (realPngData) return realPngData
  try {
    const res = await fetch('./real.png')
    const blob = await res.blob()
    realPngData = await new Promise<string>((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => resolve('')
      fr.readAsDataURL(blob)
    })
    if (realPngData) return realPngData
  } catch { /* fall through */ }
  realPngData = await imgToDataUrl()
  return realPngData
}
function getRealPng(): string { return realPngData }
void ensureRealPng()

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
  numeroSerie: string
  dateEdition: string
  lieuCreation: string
  dateEcheance: string
  rib: string
  montantChiffres: string
  monnaie: string
  ordre: string
  nomTireur: string
  nomTire: string
  adresseTire: string
  domiciliation: string
  aval: string
  banque: string
  protestable: boolean
  langue: 'fr' | 'ar'
}

interface Contact {
  id: string
  nom: string
  adresse: string
  rib: string
  banque: string
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

function loadContacts(): Contact[] {
  try { const s = localStorage.getItem('imprimcheques-contacts'); return s ? JSON.parse(s) : [] } catch { return [] }
}

function saveContacts(list: Contact[]) {
  localStorage.setItem('imprimcheques-contacts', JSON.stringify(list))
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
          <p className="text-blue-200 text-sm mt-1">SÃ©lectionnez un compte ou crÃ©ez-en un nouveau</p>
        </div>

        <div className="p-6">
          <button onClick={onNew}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-green-700 transition mb-4">
            <FaPlus /> Nouveau compte
          </button>

          {comptes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FaFolderOpen className="text-4xl mx-auto mb-3 opacity-30" />
              <p>Aucun compte enregistrÃ©</p>
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
                      <div className="text-xs text-gray-500 font-mono">NÂ° {c.numeroCompte} | Agence {c.agence}</div>
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nom du titulaire du chÃ©quier *</label>
            <input type="text" name="titulaire" value={form.titulaire} onChange={handle} dir={detectDirection(form.titulaire)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none transition"
              placeholder="Nom et prÃ©nom du titulaire" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">NÂ° Compte (RIB) - 20 chiffres *</label>
            <input type="text" name="numeroCompte" value={form.numeroCompte} onChange={handle}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none transition"
              placeholder="01000123456789012345" maxLength={20} />
            <p className="text-[9px] text-gray-400 mt-1">Code banque (2) + Agence (3) + Compte (13) + ClÃ© (2) = 20 chiffres</p>
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">NÂ° Agence (B.P.D)</label>
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">TÃ©lÃ©phone</label>
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
              CrÃ©er & Ouvrir
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

  const traiteVide = (): TraiteForm => ({
    numeroSerie: '',
    dateEdition: new Date().toISOString().split('T')[0],
    lieuCreation: '',
    dateEcheance: '',
    rib: '',
    montantChiffres: '',
    monnaie: 'DT',
    ordre: '',
    nomTireur: (BANQUES.find(b => b.code === compte.banqueCode) ? compte.titulaire : '') || '',
    nomTire: '',
    adresseTire: '',
    domiciliation: '',
    aval: '',
    banque: (BANQUES.find(b => b.code === compte.banqueCode) || { nom: '' }).nom,
    protestable: true,
    langue: 'fr',
  })

  const [traite, setTraite] = useState<TraiteForm>(traiteVide())

  const [historique, setHistorique] = useState<HistoriqueItem[]>(loadHistorique)
  const [contacts, setContacts] = useState<Contact[]>(loadContacts)

  const handleCheque = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCheque(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  const handleTraite = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const el = e.target as HTMLInputElement
    if (el.name === 'rib') { setTraite(prev => ({ ...prev, rib: el.value.replace(/\D/g, '').slice(0, 20) })); return }
    if (el.type === 'checkbox') { setTraite(prev => ({ ...prev, [el.name]: el.checked })); return }
    setTraite(prev => ({ ...prev, [el.name]: el.value }))
  }, [])

  const banqueChoisie = useMemo(() => BANQUES.find(b => b.code === compte.banqueCode), [compte.banqueCode])
  const rtlCheque = cheque.langue === 'ar'
  const mlCheque = useMemo(() => montantEnLettres(parseFloat(cheque.montantChiffres) || 0), [cheque.montantChiffres])
  const mlChequeFinal = useMemo(() => (rtlCheque ? montantEnLettresArabes(parseFloat(cheque.montantChiffres) || 0) : mlCheque), [rtlCheque, mlCheque, cheque.montantChiffres])
  const mlTraite = useMemo(() => montantEnLettresDT(parseFloat(traite.montantChiffres) || 0), [traite.montantChiffres])

  const dtMontantChiffres = useMemo(() => B1(traite.montantChiffres || '0').toUpperCase(), [traite.montantChiffres])
  const dtMontantLettres = useMemo(() => mlTraite.toUpperCase(), [mlTraite])
  const dtRibSplit = useMemo(() => x8(traite.rib || ''), [traite.rib])
  const dtEmission = useMemo(() => XS(traite.dateEdition).toUpperCase(), [traite.dateEdition])
  const dtEcheance = useMemo(() => XS(traite.dateEcheance).toUpperCase(), [traite.dateEcheance])
  const dtLieu = useMemo(() => (traite.lieuCreation || '').toUpperCase(), [traite.lieuCreation])
  const dtDom = useMemo(() => (traite.domiciliation || '').toUpperCase(), [traite.domiciliation])
  const dtNomTire = useMemo(() => (traite.nomTire || '').toUpperCase(), [traite.nomTire])

  const addContact = useCallback((c: Omit<Contact, 'id'>) => {
    const nc = { ...c, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) }
    const list = [...contacts, nc]
    setContacts(list); saveContacts(list)
    return nc
  }, [contacts])

  const pickContactAsTire = useCallback((c: Contact) => {
    setTraite(prev => ({ ...prev, nomTire: c.nom, adresseTire: c.adresse, rib: c.rib, domiciliation: c.banque }))
  }, [])

  const saveCheque = useCallback(() => {
    if (!cheque.beneficiaire || !cheque.montantChiffres) return
    const item: HistoriqueItem = { id: Date.now(), type: 'cheque', date: cheque.date, beneficiaire: cheque.beneficiaire, montant: cheque.montantChiffres, banque: banqueChoisie?.nom, numeroCheque: cheque.numeroCheque }
    const list = [item, ...historique]
    setHistorique(list)
    saveHistorique(list)
    setShowApercu(true)
  }, [cheque, banqueChoisie, historique])

  const saveTraite = useCallback(() => {
    if (!traite.nomTire || !traite.montantChiffres) return
    const item: HistoriqueItem = { id: Date.now(), type: 'traite', date: traite.dateEdition, beneficiaire: traite.nomTire, montant: traite.montantChiffres, banque: traite.domiciliation || traite.banque }
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
    const h = ['Type', 'Date', 'BÃ©nÃ©ficiaire', 'Montant (DT)', 'Banque', 'NÂ° ChÃ¨que']
    const rows = historique.map(x => [x.type === 'cheque' ? 'ChÃ¨que' : 'Traite', x.date, x.beneficiaire, x.montant, x.banque || '-', x.numeroCheque || '-'])
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

  const printTraite = useCallback(async () => {
    await ensureRealPng()
    const html = getTraitePrintHTML(traite, dtMontantChiffres, dtMontantLettres, dtRibSplit, dtEmission, dtEcheance, dtLieu, dtDom, dtNomTire)
    imprimerHTML(html, 210, 140)
    setTraite(traiteVide())
  }, [traite, dtMontantChiffres, dtMontantLettres, dtRibSplit, dtEmission, dtEcheance, dtLieu, dtDom, dtNomTire])

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg"><FaExchangeAlt className="text-xl" /></div>
            <div>
              <h1 className="text-2xl font-bold">ImprimCheques</h1>
              <p className="text-blue-200 text-xs">{compte.titulaire} | {banqueChoisie?.abbr} | NÂ° {compte.numeroCompte}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage('cheque')} className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 transition ${page === 'cheque' ? 'bg-white text-blue-900' : 'bg-white/10 hover:bg-white/20'}`}><FaCheck /> ChÃ¨que</button>
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
                <h2 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FaCheck className="text-blue-600" /> Nouveau ChÃ¨que</h2>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
                  <p className="text-[10px] font-bold text-blue-700 uppercase">Mon Compte</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div><span className="text-gray-500">Titulaire : </span><span className="font-bold">{compte.titulaire}</span></div>
                    <div><span className="text-gray-500">Banque : </span><span className="font-bold">{banqueChoisie?.abbr}</span></div>
                    <div><span className="text-gray-500">NÂ° Compte : </span><span className="font-mono font-bold">{compte.numeroCompte}</span></div>
                    <div><span className="text-gray-500">Agence : </span><span className="font-mono font-bold">{compte.agence}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">IBAN : </span><span className="font-mono font-bold text-[11px]">{compte.iban || '-'}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ville (lieu d'Ã©mission)</label><input type="text" name="lieuEmission" value={cheque.lieuEmission} onChange={handleCheque} dir={detectDirection(cheque.lieuEmission)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Sousse" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date Ã©mission</label><input type="date" name="date" value={cheque.date} onChange={handleCheque} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">NÂ° ChÃ¨que (pour historique)</label><input type="text" name="numeroCheque" value={cheque.numeroCheque} onChange={handleCheque} className="w-full border rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="00123456" /></div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Langue du chÃ¨que</label>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button onClick={() => setCheque(prev => ({ ...prev, langue: 'fr' }))} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${cheque.langue === 'fr' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>FranÃ§ais</button>
                    <button onClick={() => setCheque(prev => ({ ...prev, langue: 'ar' }))} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${cheque.langue === 'ar' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`} dir="rtl">Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="bare" checked={cheque.bare} onChange={(e) => setCheque(prev => ({ ...prev, bare: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                  <label className="text-xs font-semibold text-gray-600">ChÃ¨que barrÃ© (non endossable)</label>
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">BÃ©nÃ©ficiaire (A l'ordre de)</label><input type="text" name="beneficiaire" value={cheque.beneficiaire} onChange={handleCheque} dir={detectDirection(cheque.beneficiaire)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Nom du bÃ©nÃ©ficiaire" /></div>
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
                <button onClick={() => setShowApercu(true)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow"><FaEye /> AperÃ§u</button>
                <button onClick={saveCheque} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow"><FaPrint /> Enregistrer & Imprimer</button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 mb-3">AperÃ§u</h2>
              <ApercuCheque cheque={cheque} compte={compte} banque={banqueChoisie} ml={mlChequeFinal} rtl={rtlCheque} />
            </div>
          </div>
        )}

        {page === 'traite' && (
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className="lg:w-[460px] space-y-4">
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><FaFileInvoice className="text-amber-600" /> Nouvelle Traite (Lettre de Change)</h2>

                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setTraite(prev => ({ ...prev, langue: 'fr' }))} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${traite.langue === 'fr' ? 'bg-amber-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>Français</button>
                  <button onClick={() => setTraite(prev => ({ ...prev, langue: 'ar' }))} className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${traite.langue === 'ar' ? 'bg-amber-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`} dir="rtl">العربية</button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
                  <p className="text-[10px] font-bold text-amber-700 uppercase">Tireur (Je suis le tirant)</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div><span className="text-gray-500">Nom : </span><span className="font-bold">{compte.titulaire}</span></div>
                    <div><span className="text-gray-500">Banque : </span><span className="font-bold">{banqueChoisie?.nom}</span></div>
                  </div>
                  <div className="text-xs"><span className="text-gray-500">RIB : </span><span className="font-mono font-bold">{v8(compte.iban ? compte.iban.replace(/[^\d]/g, '').slice(-20) : '')}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">N° de série (optionnel)</label><input type="text" name="numeroSerie" value={traite.numeroSerie} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Sous impress. de l'assureur" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Lieu de création *</label><input type="text" name="lieuCreation" value={traite.lieuCreation} onChange={handleTraite} dir={detectDirection(traite.lieuCreation)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Sousse" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date d'émission</label><input type="date" name="dateEdition" value={traite.dateEdition} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date d'échéance *</label><input type="date" name="dateEcheance" value={traite.dateEcheance} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Monnaie</label>
                    <select name="monnaie" value={traite.monnaie} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      <option>DT</option><option>TND</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Montant (ex : 5381,800) *</label>
                    <input type="number" step="0.001" min="0" name="montantChiffres" value={traite.montantChiffres} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm font-mono text-lg focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="5381,800" />
                  </div>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                  <span className="text-[10px] text-amber-600 font-semibold uppercase">Montant en lettres : </span>
                  <span className="text-sm text-amber-800 font-bold italic">{mlTraite || 'Saisissez le montant'}</span>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <p className="text-[10px] font-bold text-amber-700 uppercase">Tiré (payeur)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contacts.map(c => <button key={c.id} onClick={() => pickContactAsTire(c)} title={`${c.nom} - ${c.banque || ''}`} className="text-[11px] bg-gray-100 hover:bg-amber-100 px-2 py-0.5 rounded-full border text-gray-700 transition">{c.nom}</button>)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nom du tiré *</label><input type="text" name="nomTire" value={traite.nomTire} onChange={handleTraite} dir={detectDirection(traite.nomTire)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Nom ou raison sociale" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Aval (garant)</label><input type="text" name="aval" value={traite.aval} onChange={handleTraite} dir={detectDirection(traite.aval)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Nom de l'aval" /></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Adresse du tiré</label><input type="text" name="adresseTire" value={traite.adresseTire} onChange={handleTraite} dir={detectDirection(traite.adresseTire)} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Adresse" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">RIB (20 chiffres) *</label><input type="text" name="rib" inputMode="numeric" value={traite.rib} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="00 000 000 000 000 000 00" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Domiciliation</label><input type="text" name="domiciliation" value={traite.domiciliation} onChange={handleTraite} className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Banque / agence" /></div>
                  </div>
                </div>

                <details className="border rounded p-3 bg-gray-50">
                  <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Gérer les contacts (clients/fournisseurs)</summary>
                  <div className="mt-2 space-y-2">
                    {contacts.length === 0 && <p className="text-xs text-gray-400">Aucun contact enregistré.</p>}
                    {contacts.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-xs border-b pb-1">
                        <div>
                          <div className="font-semibold">{c.nom}</div>
                          <div className="text-gray-400">{c.banque} · {c.rib || 'sans RIB'}</div>
                        </div>
                        <button onClick={() => { const list = contacts.filter(x => x.id !== c.id); setContacts(list); saveContacts(list) }} className="text-red-500 hover:text-red-700 text-xs font-semibold">Suppr.</button>
                      </div>
                    ))}
                    <ContactAdder onAdd={addContact} />
                  </div>
                </details>

                <details className="border rounded p-3 bg-gray-50">
                  <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Générer plusieurs traites (lot)</summary>
                  <GenererLot total={traite.montantChiffres} tire={traite.nomTire} onGenerate={(list) => {
                    list.forEach(lt => {
                      const it: HistoriqueItem = { id: Date.now() + Math.random(), type: 'traite', date: lt.dateEdition, beneficiaire: lt.nomTire, montant: lt.montantChiffres, banque: lt.domiciliation || lt.banque }
                      const h = [it, ...historique]; setHistorique(h); saveHistorique(h)
                    })
                    setShowApercu(true)
                  }} />
                </details>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowApercu(true)} className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition shadow"><FaEye /> Aperçu</button>
                <button onClick={saveTraite} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow"><FaPrint /> Enregistrer & Imprimer</button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Aperçu</h2>
              <ApercuTraite traite={traite} />
            </div>
          </div>
        )}

        {page === 'historique' && <PageHistorique historique={historique} onDel={delHist} onClear={clearHist} onExport={exportCSV} />}
      </div>

      {showApercu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApercu(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">AperÃ§u avant impression</h3>
              <div className="flex gap-2">
                <button onClick={() => page === 'traite' ? printTraite() : printCheque()} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"><FaPrint /> Imprimer</button>
                <button onClick={() => setShowApercu(false)} className="bg-gray-200 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300">Fermer</button>
              </div>
            </div>
            {page === 'cheque' || page === 'historique' ? <ApercuCheque cheque={cheque} compte={compte} banque={banqueChoisie} ml={mlChequeFinal} rtl={rtlCheque} /> : <ApercuTraite traite={traite} />}
          </div>
        </div>
      )}
    </div>
  )
}

function ApercuCheque({ cheque, compte, banque, ml, rtl }: { cheque: ChequeForm; compte: CompteForm; banque: typeof BANQUES[0] | undefined; ml: string; rtl: boolean }) {
  const prefMontant = rtl ? 'Ø§Ø¯ÙØ¹ÙˆØ§ Ø¨Ù…Ù‚ØªØ¶Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ø´ÙŠÙƒ ØºÙŠØ± Ø§Ù„Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªØ¸Ù‡ÙŠØ± :' : 'Payez contre ce chÃ¨que non endossable :'
  const libOrdre = rtl ? 'Ù„Ø£Ù…Ø± :' : "A l'ordre de :"
  const libVille = rtl ? 'Ø§Ù„Ø¨Ù„Ø¯Ø© :' : 'Ville :'
  const libDate = rtl ? 'Ø§Ù„ØªØ§Ø±ÙŠØ® :' : 'Date :'
  const espace = rtl ? { right: '10mm', left: '8mm', direction: 'rtl' as const } : { left: '8mm', right: '8mm' }
  const mlText = ml ? ml : 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦'
  const m = cheque.montantChiffres ? parseFloat(cheque.montantChiffres).toFixed(3) : '__.___'
  const [ligne1, ligne2] = couperLignes(mlText)

  return (
    <div style={{ width: '176mm', height: '80mm', fontFamily: 'Arial, sans-serif', border: '1px solid #999', overflow: 'hidden', position: 'relative', background: 'white', fontSize: '9px' }}>

      {/* 2 barres parallÃ¨les (chÃ¨que barrÃ©) - coin haut gauche */}
      {cheque.bare && (
        <div style={{ position: 'absolute', top: '2mm', left: '3mm', width: '8mm', height: '6mm' }}>
          <div style={{ position: 'absolute', top: '1mm', left: 0, width: '100%', height: 0, borderTop: '0.5mm solid #333', transform: 'rotate(-20deg)', transformOrigin: 'left center' }}></div>
          <div style={{ position: 'absolute', top: '3mm', left: 0, width: '100%', height: 0, borderTop: '0.5mm solid #333', transform: 'rotate(-20deg)', transformOrigin: 'left center' }}></div>
        </div>
      )}

      {/* ===== EN-TÃŠTE BANQUE (haut gauche, X 5-75 / Y 5-15) ===== */}
      <div style={{ position: 'absolute', top: '5mm', left: '8mm', right: '78mm', fontSize: '4mm', color: '#16336b', fontWeight: 'bold', lineHeight: 1.2 }}>
        {banque?.nom || 'Banque Zitouna'}
      </div>

      {/* ===== NÂ° CHÃˆQUE (Ã  cÃ´tÃ© de la case montant) ===== */}
      <div style={{ position: 'absolute', top: '6mm', left: '90mm', width: '31mm', textAlign: 'right' }}>
        <div style={{ fontSize: '2mm', color: '#777' }}>NÂ° chÃ¨que :</div>
        <div style={{ fontSize: '3mm', fontFamily: 'monospace', fontWeight: 'bold', color: '#222' }}>{cheque.numeroCheque || 'â€¦â€¦â€¦â€¦'}</div>
      </div>

      {/* ===== MONTANT EN CHIFFRES (sans cadre, tout en haut Ã  droite) ===== */}
      <div style={{ position: 'absolute', top: '0mm', right: '4mm', textAlign: 'right' }}>
        <div style={{ fontSize: '1.8mm', color: '#777' }}>B.P.D</div>
        <div style={{ fontSize: '4.5mm', fontFamily: 'monospace', fontWeight: 'bold', color: '#c00' }}>{m} DT</div>
      </div>

      {/* ===== MONTANT EN LETTRES (Payez contre + texte + points mÃªme ligne) ===== */}
      {/* Ligne 1 (25mm) : texte au dÃ©but, points aprÃ¨s, direction auto G->D / D->G */}
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

      {/* ===== A L'ORDRE DE (35mm, reculÃ©, points jusqu'au bout) ===== */}
      <div style={{ position: 'absolute', top: '35mm', display: 'flex', alignItems: 'flex-start', ...espace }}>
        <span style={{ fontSize: '2.5mm', fontWeight: 'bold', color: '#333', marginRight: '2mm', flexShrink: 0 }}>{libOrdre}</span>
        <span dir={detectDirection(cheque.beneficiaire)} style={{ fontSize: '3.5mm', fontWeight: 'bold', color: '#222', whiteSpace: 'normal', wordBreak: 'break-word', flex: '0 1 auto', minWidth: 0 }}>{cheque.beneficiaire || 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦'}</span>
        <span style={{ flex: 1, borderBottom: '0.4mm dotted #999', height: '3.5mm', marginLeft: '2mm', minWidth: '5mm' }}></span>
      </div>

      {/* ===== SIGNATURE (droite, Ã  46mm, mÃªme position dans les 2 langues) ===== */}
      <div style={{ position: 'absolute', top: '46mm', left: '122mm', width: '44mm', textAlign: 'center', fontSize: '2mm', color: '#777' }}>
        <div>Signature(s)</div>
        <div style={{ borderBottom: '0.4mm dotted #999', width: '80%', margin: '1.5mm auto 0' }}></div>
      </div>

      {/* ===== LIGNE BAS (AGENCE gauche / NÂ° compte au milieu, Ã  43mm) ===== */}
      <div style={{ position: 'absolute', top: '43mm', left: '8mm', right: '8mm', display: 'flex', alignItems: 'center', ...(rtl ? { direction: 'rtl' } : {}) }}>
        {/* A.G.E.N.C.E (gauche) */}
        <div style={{ flex: 1, fontSize: '2mm', color: '#777' }}>
          <div>A.G.E.N.C.E</div>
          <div style={{ fontWeight: 'bold', fontSize: '3mm', color: '#333' }}>{compte.agence || '___'}</div>
        </div>

        {/* NÂ° compte (au milieu exactement) */}
        <div style={{ flex: 1, textAlign: 'center', fontSize: '2mm', color: '#777' }}>
          <div>NÂ° de compte</div>
          <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '3mm', color: '#333', letterSpacing: '0.5mm', marginTop: '0.5mm' }}>{compte.numeroCompte || 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦'}</div>
        </div>

        {/* Espaceur symÃ©trique pour garder NÂ° compte centrÃ© */}
        <div style={{ flex: 1 }}></div>
      </div>

      {/* ===== VILLE + DATE (Ã  56mm, toujours au milieu) ===== */}
      <div style={{ position: 'absolute', top: '56mm', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'baseline', gap: '1mm', whiteSpace: 'nowrap', ...(rtl ? { direction: 'rtl' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '2.5mm', color: '#555', marginRight: '1mm' }}>{libVille}</span>
          <span dir={detectDirection(cheque.lieuEmission)} style={{ fontSize: '3mm', fontWeight: 'bold', color: '#222', borderBottom: '0.4mm dotted #999', padding: '0 2mm' }}>{cheque.lieuEmission || 'â€¦â€¦â€¦â€¦â€¦'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '2.5mm', color: '#555', marginRight: '1mm' }}>{libDate}</span>
          <span dir="ltr" style={{ fontSize: '3mm', fontWeight: 'bold', color: '#222', borderBottom: '0.4mm dotted #999', padding: '0 2mm' }}>{cheque.date || 'â€¦/â€¦/â€¦â€¦'}</span>
        </div>
      </div>

      {/* ===== MICR (en bas, ne couvre pas la date) ===== */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: '42mm', background: '#f5f5f5', borderTop: '1px solid #ddd', padding: '1.5mm 12mm', textAlign: 'center', fontFamily: 'monospace', fontSize: '2.5mm', color: '#555', letterSpacing: '1.5mm' }}>
        â‘†{compte.numeroCompte || 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦'} â‘†{compte.agence || 'â€¦â€¦'} â‘†â€¢â€¢â€¢
      </div>
    </div>
  )
}

function ContactAdder({ onAdd }: { onAdd: (c: Omit<Contact, 'id'>) => Contact }) {
  const [f, setF] = useState({ nom: '', adresse: '', rib: '', banque: '' })
  const sub = () => {
    if (!f.nom) return
    onAdd(f)
    setF({ nom: '', adresse: '', rib: '', banque: '' })
  }
  return (
    <div className="space-y-2">
      <input type="text" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} placeholder="Nom / raison sociale" className="w-full border rounded px-2 py-1 text-xs" />
      <input type="text" value={f.adresse} onChange={e => setF({ ...f, adresse: e.target.value })} placeholder="Adresse" className="w-full border rounded px-2 py-1 text-xs" />
      <div className="flex gap-2">
        <input type="text" value={f.rib} onChange={e => setF({ ...f, rib: e.target.value.replace(/\D/g, '').slice(0, 20) })} placeholder="RIB (20)" className="flex-1 border rounded px-2 py-1 text-xs font-mono" />
        <input type="text" value={f.banque} onChange={e => setF({ ...f, banque: e.target.value })} placeholder="Banque / agence" className="flex-1 border rounded px-2 py-1 text-xs" />
      </div>
      <button onClick={sub} className="w-full bg-amber-600 text-white text-xs font-bold py-1.5 rounded hover:bg-amber-700">Ajouter contact</button>
    </div>
  )
}

function GenererLot({ total, tire, onGenerate }: { total: string; tire: string; onGenerate: (list: TraiteForm[]) => void }) {
  const [n, setN] = useState(2)
  const [freq, setFreq] = useState(30)
  const [unite, setUnite] = useState<'jours' | 'mois'>('jours')
  const [start, setStart] = useState(new Date().toISOString().split('T')[0])
  const generer = () => {
    const num = Math.max(1, Math.floor(n))
    const tot = parseFloat(total) || 0
    if (tot <= 0) return
    const part = Math.round((tot / num) * 1000) / 1000
    const list: TraiteForm[] = []
    let d = new Date(start)
    for (let i = 0; i < num; i++) {
      const dd = new Date(d)
      list.push({
        numeroSerie: `LOT-${i + 1}`,
        dateEdition: new Date().toISOString().split('T')[0],
        lieuCreation: '',
        dateEcheance: dd.toISOString().split('T')[0],
        rib: '',
        montantChiffres: String(num - 1 === i ? (tot - part * (num - 1)).toFixed(3) : part.toFixed(3)),
        monnaie: 'DT',
        ordre: '',
        nomTireur: '',
        nomTire: tire,
        adresseTire: '',
        domiciliation: '',
        aval: '',
        banque: '',
        protestable: true,
        langue: 'fr',
      })
      if (unite === 'jours') d.setDate(d.getDate() + freq)
      else d.setMonth(d.getMonth() + freq)
    }
    onGenerate(list)
  }
  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Nombre</label>
          <input type="number" min="1" value={n} onChange={e => setN(parseInt(e.target.value) || 1)} className="w-full border rounded px-2 py-1 text-xs" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Fréquence</label>
          <input type="number" min="1" value={freq} onChange={e => setFreq(parseInt(e.target.value) || 1)} className="w-full border rounded px-2 py-1 text-xs" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Unité</label>
          <select value={unite} onChange={e => setUnite(e.target.value as 'jours' | 'mois')} className="w-full border rounded px-2 py-1 text-xs"><option value="jours">jours</option><option value="mois">mois</option></select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Première échéance</label>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full border rounded px-2 py-1 text-xs" />
      </div>
      <p className="text-[10px] text-gray-500">Montant total : <b>{total || '—'}</b> réparti en {Math.max(1, Math.floor(n))} traite(s).</p>
      <button onClick={generer} className="w-full bg-amber-600 text-white text-xs font-bold py-1.5 rounded hover:bg-amber-700">Générer le lot</button>
    </div>
  )
}

function ApercuTraite({ traite }: { traite: TraiteForm }) {
  const [ribCode, ribAg, ribCompte, ribCle] = x8(traite.rib || '')
  const montCh = B1(traite.montantChiffres || '0').toUpperCase()
  const montLet = montantEnLettresDT(parseFloat(traite.montantChiffres) || 0).toUpperCase()
  const emis = XS(traite.dateEdition).toUpperCase()
  const ech = XS(traite.dateEcheance).toUpperCase()
  const lieu = (traite.lieuCreation || '').toUpperCase()
  const dom = (traite.domiciliation || '').toUpperCase()
  const nomTire = (traite.nomTire || '').toUpperCase()
  const addrTire = (traite.adresseTire || '').toUpperCase()
  const nomTireur = (traite.nomTireur || '').toUpperCase()
  const aval = (traite.aval || '').toUpperCase()
  const Box = ({ top, left, w, h, children }: { top: string; left: string; w: string; h: string; children: React.ReactNode }) => (
    <div style={{ position: 'absolute', top, left, width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#111', fontSize: '3mm', whiteSpace: 'nowrap', overflow: 'hidden' }} dir="ltr">{children}</div>
  )
  return (
    <div style={{ width: '210mm', background: '#fff' }}>
      <div style={{ width: '175mm', height: '115mm', backgroundImage: 'url("./real.png")', backgroundSize: 'cover', backgroundPosition: 'center', padding: '20mm', position: 'relative', margin: '0 auto' }}>
        <Box top="15mm" left="50mm" w="30mm" h="6mm">{ech}</Box>
        <Box top="10mm" left="86mm" w="30mm" h="5mm">{lieu}</Box>
        <Box top="15mm" left="86mm" w="30mm" h="7mm">{emis}</Box>
        <Box top="24mm" left="135mm" w="39mm" h="6mm">{montCh}</Box>
        <Box top="39mm" left="135mm" w="39mm" h="6mm">{montCh}</Box>
        <Box top="24mm" left="49mm" w="11mm" h="7mm">{ribCode}</Box>
        <Box top="24mm" left="60.5mm" w="11mm" h="7mm">{ribAg}</Box>
        <Box top="24mm" left="72mm" w="44mm" h="7mm">{ribCompte}</Box>
        <Box top="24mm" left="117mm" w="8mm" h="7mm">{ribCle}</Box>
        <Box top="42mm" left="48mm" w="50mm" h="6mm">{dom}</Box>
        {traite.nomTireur && <Box top="38mm" left="3mm" w="41mm" h="8mm">{nomTireur}</Box>}
        <Box top="49mm" left="16mm" w="149mm" h="6mm">{montLet}</Box>
        <Box top="74mm" left="77mm" w="39mm" h="9mm">{nomTire}</Box>
        <Box top="84mm" left="77mm" w="39mm" h="9mm">{addrTire}</Box>
        <Box top="69mm" left="119mm" w="55mm" h="11mm">{dom}</Box>
        <Box top="58mm" left="58mm" w="27mm" h="6mm">{ech}</Box>
        <Box top="58mm" left="3mm" w="26mm" h="6mm">{lieu}</Box>
        <Box top="58mm" left="31mm" w="26mm" h="6mm">{emis}</Box>
        <Box top="69mm" left="3mm" w="6mm" h="6.5mm">{ribCode}</Box>
        <Box top="69mm" left="10mm" w="10mm" h="6.5mm">{ribAg}</Box>
        <Box top="69mm" left="21mm" w="46mm" h="6.5mm">{ribCompte}</Box>
        <Box top="69mm" left="68mm" w="7mm" h="6.5mm">{ribCle}</Box>
        <Box top="82mm" left="42mm" w="30mm" h="12mm">{aval}</Box>
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
        <div className="text-center py-12 text-gray-400"><FaHistory className="text-4xl mx-auto mb-3 opacity-30" /><p>Aucun Ã©lÃ©ment enregistrÃ©.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-100 text-gray-600 text-xs uppercase"><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">BÃ©nÃ©ficiaire</th><th className="px-3 py-2 text-right">Montant (DT)</th><th className="px-3 py-2 text-left">Banque</th><th className="px-3 py-2 text-left">NÂ° ChÃ¨que</th><th className="px-3 py-2 text-center">BarrÃ©</th><th className="px-3 py-2 text-center">Actions</th></tr></thead>
            <tbody>{historique.map(h => (
              <tr key={h.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${h.type === 'cheque' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{h.type === 'cheque' ? 'ChÃ¨que' : 'Traite'}</span></td>
                <td className="px-3 py-2 text-gray-700">{h.date}</td>
                <td className="px-3 py-2 font-semibold">{h.beneficiaire}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{parseFloat(h.montant).toFixed(3)}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{h.banque || '-'}</td>
                <td className="px-3 py-2 font-mono text-xs">{h.numeroCheque || '-'}</td>
                <td className="px-3 py-2 text-center">{h.type === 'cheque' ? <span className="text-green-600 font-bold">âœ“</span> : <span className="text-gray-400">-</span>}</td>
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
  const mlText = ml ? ml : 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦'
  const m = cheque.montantChiffres ? parseFloat(cheque.montantChiffres).toFixed(3) : '__.___'
  const [ligne1, ligne2] = couperLignes(mlText)
  const prefMontant = rtl ? 'Ø§Ø¯ÙØ¹ÙˆØ§ Ø¨Ù…Ù‚ØªØ¶Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ø´ÙŠÙƒ ØºÙŠØ± Ø§Ù„Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªØ¸Ù‡ÙŠØ± :' : 'Payez contre ce chÃ¨que non endossable :'
  const libOrdre = rtl ? 'Ù„Ø£Ù…Ø± :' : "A l'ordre de :"
  const libVille = rtl ? 'Ø§Ù„Ø¨Ù„Ø¯Ø© :' : 'Ville :'
  const libDate = rtl ? 'Ø§Ù„ØªØ§Ø±ÙŠØ® :' : 'Date :'
  const espace = rtl ? 'right:10mm;left:8mm;direction:rtl;' : 'left:8mm;right:8mm;'
  const villeStyle = rtl ? 'top:56mm;left:50%;transform:translateX(-50%);display:flex;align-items:baseline;gap:1mm;white-space:nowrap;direction:rtl;' : 'top:56mm;left:50%;transform:translateX(-50%);display:flex;align-items:baseline;gap:1mm;white-space:nowrap;'
  const dateStyle = ''
  const milliStyle = rtl ? 'font-style:normal;' : 'font-style:italic;'

  return `<div class="cheque" style="font-family:Arial,sans-serif;overflow:hidden;position:relative;background:transparent;margin:0;font-size:9px;">
    <div style="position:absolute;top:6mm;right:4mm;text-align:right;"><div style="font-size:4.5mm;font-family:monospace;font-weight:bold;color:#c00;">${m} DT</div></div>
    <div style="position:absolute;top:25mm;${espace}display:flex;align-items:flex-start;"><span style="font-size:2.5mm;color:#555;${milliStyle}margin-right:2mm;white-space:nowrap;flex-shrink:0;visibility:hidden;">${prefMontant}</span><span style="font-size:3.5mm;font-weight:bold;color:#222;white-space:normal;word-break:break-word;flex:0 1 auto;min-width:0;">${ligne1}</span></div>
    <div style="position:absolute;top:30mm;${espace}display:flex;align-items:flex-start;"><span style="font-size:3.5mm;font-weight:bold;color:#222;white-space:normal;word-break:break-word;flex:0 1 auto;min-width:0;">${ligne2}</span></div>
    <div style="position:absolute;top:35mm;${espace}display:flex;align-items:flex-start;"><span style="font-size:2.5mm;font-weight:bold;color:#333;margin-right:2mm;flex-shrink:0;visibility:hidden;">${libOrdre}</span><span style="font-size:3.5mm;font-weight:bold;color:#222;white-space:normal;word-break:break-word;flex:0 1 auto;min-width:0;" dir="${detectDirection(cheque.beneficiaire)}">${cheque.beneficiaire || 'â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦â€¦'}</span></div>
    <div style="position:absolute;${villeStyle}"><div style="display:flex;align-items:baseline;"><span style="font-size:2.5mm;color:#555;margin-right:1mm;">${libVille}</span><span style="font-size:3mm;font-weight:bold;color:#222;padding:0 2mm;" dir="${detectDirection(cheque.lieuEmission)}">${cheque.lieuEmission || 'â€¦â€¦â€¦â€¦â€¦'}</span></div><div style="display:flex;align-items:baseline;${dateStyle}"><span style="font-size:2.5mm;color:#555;margin-right:1mm;">${libDate}</span><span dir="ltr" style="font-size:3mm;font-weight:bold;color:#222;padding:0 2mm;">${cheque.date || 'â€¦/â€¦/â€¦â€¦'}</span></div></div>
  </div>`
}

function getTraitePrintHTML(traite: TraiteForm, montCh: string, montLet: string, ribSplit: string[], emis: string, ech: string, lieu: string, dom: string, nomTire: string): string {
  const [ribCode, ribAg, ribCompte, ribCle] = ribSplit
  const bg = getRealPng() || './real.png'
  const esc = (s: string) => String(s == null ? '' : s).replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const cell = (top: string, left: string, w: string, h: string, txt: string) =>
    `<div style="position:absolute;top:${top};left:${left};width:${w};height:${h};display:flex;align-items:center;justify-content:center;font-weight:bold;color:#111;font-size:3mm;white-space:nowrap;overflow:hidden;direction:ltr;">${esc(txt)}</div>`

  return `<div style="width:210mm;height:135mm;margin:0;background:#fff;">
    <div style="width:175mm;height:115mm;margin:0 auto;background-image:url('${bg}');background-size:cover;background-position:center;padding:20mm;position:relative;">
      ${cell('15mm','50mm','30mm','6mm',ech)}
      ${cell('10mm','86mm','30mm','5mm',lieu)}
      ${cell('15mm','86mm','30mm','7mm',emis)}
      ${cell('24mm','135mm','39mm','6mm',montCh)}
      ${cell('39mm','135mm','39mm','6mm',montCh)}
      ${cell('24mm','49mm','11mm','7mm',ribCode)}
      ${cell('24mm','60.5mm','11mm','7mm',ribAg)}
      ${cell('24mm','72mm','44mm','7mm',ribCompte)}
      ${cell('24mm','117mm','8mm','7mm',ribCle)}
      ${cell('42mm','48mm','50mm','6mm',dom)}
      ${traite.nomTireur ? cell('38mm','3mm','41mm','8mm',traite.nomTireur.toUpperCase()) : ''}
      ${cell('49mm','16mm','149mm','6mm',montLet)}
      ${cell('74mm','77mm','39mm','9mm',nomTire)}
      ${cell('84mm','77mm','39mm','9mm',esc(traite.adresseTire || '').toUpperCase())}
      ${cell('69mm','119mm','55mm','11mm',dom)}
      ${cell('58mm','58mm','27mm','6mm',ech)}
      ${cell('58mm','3mm','26mm','6mm',lieu)}
      ${cell('58mm','31mm','26mm','6mm',emis)}
      ${cell('69mm','3mm','6mm','6.5mm',ribCode)}
      ${cell('69mm','10mm','10mm','6.5mm',ribAg)}
      ${cell('69mm','21mm','46mm','6.5mm',ribCompte)}
      ${cell('69mm','68mm','7mm','6.5mm',ribCle)}
      ${cell('82mm','42mm','30mm','12mm',esc(traite.aval || '').toUpperCase())}
    </div>
  </div>`
}
