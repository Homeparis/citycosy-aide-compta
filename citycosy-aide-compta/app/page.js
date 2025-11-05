'use client';

import { useState } from 'react';
import { Upload, Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [lodgifyData, setLodgifyData] = useState([]);
  const [airbnbData, setAirbnbData] = useState([]);
  const [fusedData, setFusedData] = useState([]);
  const [stats, setStats] = useState({ total: 0, matched: 0, lodgifyOnly: 0, airbnbOnly: 0, alerts: 0 });

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  };

  const handleLodgifyUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    
    const data = parsed.map((row, index) => {
      const sourceText = (row.SourceText || '').toString();
      const match = sourceText.match(/\b[A-Z0-9]{10}\b/i);
      let codeClean = match ? match[0].toUpperCase() : '';
      
      if (codeClean) {
        const hasLetters = /[A-Z]/i.test(codeClean);
        const hasDigits = /[0-9]/.test(codeClean);
        if (!hasLetters || !hasDigits) {
          codeClean = '';
        }
      }
      
      if (!codeClean && sourceText && index < 5) {
        console.log(`Lodgify ligne ${index}: SourceText="${sourceText}" → Pas de code trouvé`);
      }
      
      return {
        codeResa: codeClean,
        client: row.Name || '',
        appartement: row.HouseName || '',
        arrivee: row.DateArrival || '',
        depart: row.DateDeparture || '',
        source: row.Source || 'Lodgify',
        montantOriginal: parseFloat((row.TotalAmount || '0').replace(/\s/g, '').replace(',', '.')),
        internalCode: row.InternalCode || '',
        sourceTextRaw: sourceText
      };
    });

    setLodgifyData(data);
    alert(`✅ ${data.length} réservations Lodgify chargées`);
  };

  const handleAirbnbUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    
    const data = parsed.map(row => {
      const montantStr = (row.Montant || row.montant || '0').toString().trim();
      const montantClean = montantStr.replace(/[€$\s]/g, '').replace(',', '.');
      
      const codeRaw = (row['code réservation'] || row['code reservation'] || '').toString();
      const match = codeRaw.match(/\b[A-Z0-9]{10}\b/i);
      let codeClean = match ? match[0].toUpperCase() : '';
      
      if (codeClean) {
        const hasLetters = /[A-Z]/i.test(codeClean);
        const hasDigits = /[0-9]/.test(codeClean);
        if (!hasLetters || !hasDigits) {
          codeClean = '';
        }
      }
      
      return {
        codeResa: codeClean,
        client: (row.client || row.Client || '').trim(),
        appartement: (row.appartement || row.Appartement || '').trim(),
        montant: parseFloat(montantClean) || 0,
        date: row.date || ''
      };
    });

    setAirbnbData(data);
    alert(`✅ ${data.length} paiements Airbnb chargés`);
  };

  const fusionner = () => {
    if (lodgifyData.length === 0 && airbnbData.length === 0) {
      alert('Veuillez charger au moins un fichier.');
      return;
    }

    // ✅ ÉTAPE 1 : Grouper les paiements Airbnb par code
    const airbnbGrouped = {};
    airbnbData.forEach(row => {
      const code = row.codeResa;
      if (!code || code === 'AUCUN DÉTAIL' || code === '') {
        if (!airbnbGrouped['_SANS_DETAIL']) {
          airbnbGrouped['_SANS_DETAIL'] = [];
        }
        airbnbGrouped['_SANS_DETAIL'].push(row);
      } else {
        if (!airbnbGrouped[code]) {
          airbnbGrouped[code] = [];
        }
        airbnbGrouped[code].push(row);
      }
    });

    console.log('=== DEBUG MATCHING ===');
    console.log('Codes Airbnb trouvés:', Object.keys(airbnbGrouped).filter(k => k !== '_SANS_DETAIL'));
    console.log('Codes Lodgify:', lodgifyData.map(l => l.codeResa).filter(c => c));

    // ✅ ÉTAPE 2 : Dédupliquer et calculer les sommes
    const airbnbSums = {};
    Object.keys(airbnbGrouped).forEach(code => {
      const payments = airbnbGrouped[code];
      
      // Trier par date pour avoir un ordre chronologique
      payments.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return dateA - dateB;
      });
      
      // ✅ Dédupliquer : même montant + même date = 1 seule ligne
      const unique = [];
      const seen = new Set();
      
      for (const payment of payments) {
        const key = `${payment.montant.toFixed(2)}_${payment.date}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(payment);
        }
      }
      
      // Calculer la somme et le détail
      const sum = unique.reduce((acc, p) => acc + p.montant, 0);
      let detailPaiements = '';
      
      if (unique.length > 1) {
        detailPaiements = unique
          .map(p => `${p.montant.toFixed(2)}€ (${p.date || '?'})`)
          .join(' + ');
      }
      
      airbnbSums[code] = {
        montantTotal: sum,
        nbPaiements: unique.length,
        detailPaiements: detailPaiements,
        details: unique
      };
    });

    const result = [];
    const processedAirbnbCodes = new Set();
    const alerts = [];

    // ✅ ÉTAPE 3 : Traiter les réservations Lodgify
    lodgifyData.forEach(lodgify => {
      const code = lodgify.codeResa;
      
      if (code && airbnbSums[code]) {
        const airbnbInfo = airbnbSums[code];
        processedAirbnbCodes.add(code);

        const matchingLodgify = lodgifyData.filter(l => l.codeResa === code);
        let alerte = '';
        if (matchingLodgify.length > 1) {
          alerte = `⚠️ ${matchingLodgify.length} réservations Lodgify avec ce code`;
          alerts.push(code);
        }
        
        // ✅ Ajouter l'alerte multi-paiements
        if (airbnbInfo.nbPaiements > 1) {
          alerte = alerte ? `${alerte} | MULTI_VERSEMENT (${airbnbInfo.nbPaiements} paiements)` : `MULTI_VERSEMENT (${airbnbInfo.nbPaiements} paiements)`;
        }

        result.push({
          appartement: lodgify.appartement,
          arrivee: lodgify.arrivee,
          depart: lodgify.depart,
          client: lodgify.client,
          codeResa: code,
          montantFinal: airbnbInfo.montantTotal,
          montantOriginal: lodgify.montantOriginal,
          nbPaiements: airbnbInfo.nbPaiements,
          detailPaiements: airbnbInfo.detailPaiements,
          site: 'Airbnb',
          statut: 'PAYÉ',
          alerte: alerte,
          type: 'matched'
        });
      } else {
        result.push({
          appartement: lodgify.appartement,
          arrivee: lodgify.arrivee,
          depart: lodgify.depart,
          client: lodgify.client,
          codeResa: code,
          montantFinal: lodgify.montantOriginal,
          montantOriginal: lodgify.montantOriginal,
          nbPaiements: 0,
          detailPaiements: '',
          site: lodgify.source,
          statut: lodgify.source === 'Booking.com' ? 'CB Booking' : 
                  (lodgify.source === 'Manuel' || lodgify.source === 'Site web') ? 'Virement' : 
                  'EN ATTENTE PAIEMENT AIRBNB',
          alerte: '',
          type: 'lodgify-only'
        });
      }
    });

    // ✅ ÉTAPE 4 : Airbnb-only
    Object.keys(airbnbSums).forEach(code => {
      if (code !== '_SANS_DETAIL' && !processedAirbnbCodes.has(code)) {
        const airbnbInfo = airbnbSums[code];
        const firstPayment = airbnbInfo.details[0];
        
        let alerte = '⚠️ Paiement Airbnb sans réservation Lodgify';
        if (airbnbInfo.nbPaiements > 1) {
          alerte += ` | MULTI_VERSEMENT (${airbnbInfo.nbPaiements} paiements)`;
        }
        
        result.push({
          appartement: firstPayment.appartement,
          arrivee: firstPayment.date,
          depart: '',
          client: firstPayment.client,
          codeResa: code,
          montantFinal: airbnbInfo.montantTotal,
          montantOriginal: 0,
          nbPaiements: airbnbInfo.nbPaiements,
          detailPaiements: airbnbInfo.detailPaiements,
          site: 'Airbnb',
          statut: 'MANQUANT DANS LODGIFY',
          alerte: alerte,
          type: 'airbnb-only'
        });
      }
    });

    // ✅ ÉTAPE 5 : Sans détail
    if (airbnbSums['_SANS_DETAIL']) {
      airbnbSums['_SANS_DETAIL'].details.forEach(payment => {
        result.push({
          appartement: payment.appartement || 'N/A',
          arrivee: payment.date || '',
          depart: '',
          client: payment.client || 'N/A',
          codeResa: 'aucun détail',
          montantFinal: payment.montant,
          montantOriginal: 0,
          nbPaiements: 1,
          detailPaiements: '',
          site: 'Airbnb',
          statut: 'SANS DÉTAIL',
          alerte: '',
          type: 'no-detail'
        });
      });
    }

    const withDetails = result.filter(r => r.type !== 'no-detail');
    const noDetails = result.filter(r => r.type === 'no-detail');

    const sorted = withDetails.sort((a, b) => {
      if (a.appartement !== b.appartement) {
        return a.appartement.localeCompare(b.appartement);
      }
      return new Date(a.arrivee) - new Date(b.arrivee);
    });

    const final = [...sorted, ...noDetails];

    setFusedData(final);
    setStats({
      total: final.length,
      matched: final.filter(r => r.type === 'matched').length,
      lodgifyOnly: final.filter(r => r.type === 'lodgify-only').length,
      airbnbOnly: final.filter(r => r.type === 'airbnb-only').length,
      alerts: alerts.length
    });
  };

  const exporter = () => {
    if (fusedData.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }
    
    const headers = ['Appartement', 'Arrivée', 'Départ', 'Client', 'Code Réservation', 'Montant', 'Nb Paiements', 'Détail Paiements', 'Site/OTA', 'Statut', 'Alerte'];
    const csv = [
      headers.join(';'),
      ...fusedData.map(r => [
        `"${r.appartement}"`,
        r.arrivee,
        r.depart,
        `"${r.client}"`,
        r.codeResa,
        r.montantFinal.toFixed(2).replace('.', ',') + '€',
        r.nbPaiements > 1 ? r.nbPaiements : '',
        `"${r.detailPaiements || ''}"`,
        r.site,
        r.statut,
        `"${r.alerte}"`
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citycosy_fusion_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const reinitialiser = () => {
    setLodgifyData([]);
    setAirbnbData([]);
    setFusedData([]);
    setStats({ total: 0, matched: 0, lodgifyOnly: 0, airbnbOnly: 0, alerts: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="text-center mb-12">
          <div className="inline-block bg-gradient-to-r from-red-600 to-black px-8 py-4 rounded-2xl shadow-2xl mb-6">
            <h1 className="text-5xl font-black text-white tracking-tight">
              City<span className="text-red-300">Cosy</span>
            </h1>
            <div className="text-red-400 text-xs font-mono mt-1">v2</div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Aide Comptabilité
          </h2>
          <p className="text-lg text-gray-600 mb-6">Fusion intelligente Lodgify + Airbnb</p>
          
          <Link href="/factures">
            <button className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition shadow-lg">
              🏡Factures Locataires📄
            </button>
          </Link>
          <Link href="/factures-gestion">
            <button className="mt-4 bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition shadow-lg">
              📊 Factures de Gestion 💰
            </button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-600 mb-4">Lodgify (Réservations)</h2>
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition">
                <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                <p className="text-gray-600">Cliquez pour charger le CSV Lodgify</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleLodgifyUpload} />
            </label>
            {lodgifyData.length > 0 && (
              <div className="mt-4 flex items-center text-green-600">
                <CheckCircle className="mr-2" />
                <span className="font-semibold">{lodgifyData.length} réservations</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-pink-600 mb-4">Airbnb (Versements)</h2>
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-pink-500 hover:bg-pink-50 cursor-pointer transition">
                <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                <p className="text-gray-600">Cliquez pour charger le CSV Airbnb</p>
              </div>
              <input type="file" className="hidden" accept=".csv" onChange={handleAirbnbUpload} />
            </label>
            {airbnbData.length > 0 && (
              <div className="mt-4 flex items-center text-green-600">
                <CheckCircle className="mr-2" />
                <span className="font-semibold">{airbnbData.length} paiements</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={fusionner}
            className="bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition flex items-center gap-2 shadow-lg"
          >
            <RefreshCw size={24} />
            Fusionner & Calculer
          </button>
          
          <button
            onClick={exporter}
            disabled={fusedData.length === 0}
            className="bg-black text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-800 transition flex items-center gap-2 disabled:bg-gray-400 shadow-lg"
          >
            <Download size={24} />
            Exporter CSV
          </button>

          <button
            onClick={reinitialiser}
            className="bg-white text-gray-700 border-2 border-gray-300 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition shadow-lg"
          >
            Réinitialiser
          </button>
        </div>

        {fusedData.length > 0 && (
          <>
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-lg p-4 text-center border-l-4 border-red-600">
                <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-600 font-medium">Total</div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-4 text-center border-l-4 border-green-600">
                <div className="text-3xl font-bold text-green-600">{stats.matched}</div>
                <div className="text-sm text-gray-600 font-medium">Matchés</div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-4 text-center border-l-4 border-black">
                <div className="text-3xl font-bold text-gray-900">{stats.lodgifyOnly}</div>
                <div className="text-sm text-gray-600 font-medium">Lodgify seul</div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-4 text-center border-l-4 border-gray-400">
                <div className="text-3xl font-bold text-gray-700">{stats.airbnbOnly}</div>
                <div className="text-sm text-gray-600 font-medium">Airbnb seul</div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-4 text-center border-l-4 border-orange-500">
                <div className="text-3xl font-bold text-orange-600">{stats.alerts}</div>
                <div className="text-sm text-gray-600 font-medium">Alertes</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-black p-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>📊</span> Résultats de la fusion
                </h3>
              </div>
              <div className="overflow-x-auto p-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-3 text-left font-bold text-gray-900">Appartement</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-900">Arrivée</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-900">Départ</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-900">Client</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-900">Code</th>
                      <th className="px-3 py-3 text-right font-bold text-gray-900">Montant</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-900">Nb Paie.</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-900">Site</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-900">Statut</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-900">Alerte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fusedData.map((row, i) => (
                      <tr key={i} className={`border-t hover:bg-gray-50 ${row.alerte ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-3 font-semibold text-gray-900">{row.appartement}</td>
                        <td className="px-3 py-3 text-gray-700">{row.arrivee}</td>
                        <td className="px-3 py-3 text-gray-700">{row.depart}</td>
                        <td className="px-3 py-3 text-gray-900">{row.client}</td>
                        <td className="px-3 py-3 text-xs text-gray-600">{row.codeResa}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="font-bold text-gray-900">{row.montantFinal.toFixed(2)}€</div>
                          {row.detailPaiements && (
                            <div className="text-xs text-orange-600 mt-1">{row.detailPaiements}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.nbPaiements > 1 && (
                            <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                              {row.nbPaiements}x
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                            row.site === 'Airbnb' ? 'bg-[#FF5A5F]' : 
                            row.site === 'Booking.com' ? 'bg-blue-600' :
                            row.site === 'Manuel' || row.site === 'Site web' ? 'bg-black' :
                            'bg-gray-500'
                          }`}>
                            {row.site === 'Manuel' || row.site === 'Site web' ? 'CityCosy' : row.site}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            row.statut === 'PAYÉ' ? 'bg-green-100 text-green-800' :
                            row.statut === 'SANS DÉTAIL' ? 'bg-gray-200 text-gray-700' :
                            row.statut === 'CB Booking' ? 'bg-blue-600 text-white' :
                            row.statut === 'EN ATTENTE PAIEMENT AIRBNB' ? 'bg-[#00A699] text-white' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {row.statut}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-red-600">
                          {row.alerte && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle size={14} />
                              <span className="font-medium">{row.alerte}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
