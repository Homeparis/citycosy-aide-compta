'use client';

import { useState } from 'react';
import { Upload, Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

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
    
    const data = parsed.map(row => ({
      codeResa: (row.SourceText || '').trim().toUpperCase(),
      client: row.Name || '',
      appartement: row.HouseName || '',
      arrivee: row.DateArrival || '',
      depart: row.DateDeparture || '',
      source: row.Source || 'Lodgify',
      montantOriginal: parseFloat((row.TotalAmount || '0').replace(',', '.')),
      internalCode: row.InternalCode || ''
    }));

    setLodgifyData(data);
    alert(`✅ ${data.length} réservations Lodgify chargées`);
  };

  const handleAirbnbUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    
    const data = parsed.map(row => {
      // Corriger le montant : virgule française → point décimal
      const montantStr = (row.Montant || row.montant || '0').toString().trim();
      const montantClean = montantStr.replace(/[€$\s]/g, '').replace(',', '.');
      
      return {
        codeResa: (row['code réservation'] || row['code reservation'] || '').trim().toUpperCase(),
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

    // 1. Grouper et sommer les paiements Airbnb par code réservation
    const airbnbGrouped = {};
    airbnbData.forEach(row => {
      const code = row.codeResa;
      if (!code || code === 'aucun détail' || code === '') {
        // Ligne sans détail - on la garde à part
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

    // Calculer sommes et nb paiements
    const airbnbSums = {};
    Object.keys(airbnbGrouped).forEach(code => {
      const payments = airbnbGrouped[code];
      const sum = payments.reduce((acc, p) => acc + p.montant, 0);
      airbnbSums[code] = {
        montantTotal: sum,
        nbPaiements: payments.length,
        details: payments
      };
    });

    const result = [];
    const processedAirbnbCodes = new Set();
    const alerts = [];

    // 2. Traiter les réservations Lodgify
    lodgifyData.forEach(lodgify => {
      const code = lodgify.codeResa;
      
      // Vérifier s'il y a un paiement Airbnb correspondant
      if (code && airbnbSums[code]) {
        const airbnbInfo = airbnbSums[code];
        processedAirbnbCodes.add(code);

        // Vérifier doublons
        const matchingLodgify = lodgifyData.filter(l => l.codeResa === code);
        let alerte = '';
        if (matchingLodgify.length > 1) {
          alerte = `⚠️ ${matchingLodgify.length} réservations Lodgify avec ce code`;
          alerts.push(code);
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
          site: 'Airbnb',
          statut: 'PAYÉ',
          alerte: alerte,
          type: 'matched'
        });
      } else {
        // Lodgify sans Airbnb
        result.push({
          appartement: lodgify.appartement,
          arrivee: lodgify.arrivee,
          depart: lodgify.depart,
          client: lodgify.client,
          codeResa: code,
          montantFinal: lodgify.montantOriginal,
          montantOriginal: lodgify.montantOriginal,
          nbPaiements: 0,
          site: lodgify.source,
          statut: 'EN ATTENTE PAIEMENT AIRBNB',
          alerte: '',
          type: 'lodgify-only'
        });
      }
    });

    // 3. Traiter les paiements Airbnb sans correspondance Lodgify
    Object.keys(airbnbSums).forEach(code => {
      if (code !== '_SANS_DETAIL' && !processedAirbnbCodes.has(code)) {
        const airbnbInfo = airbnbSums[code];
        const firstPayment = airbnbInfo.details[0];
        
        result.push({
          appartement: firstPayment.appartement,
          arrivee: firstPayment.date,
          depart: '',
          client: firstPayment.client,
          codeResa: code,
          montantFinal: airbnbInfo.montantTotal,
          montantOriginal: 0,
          nbPaiements: airbnbInfo.nbPaiements,
          site: 'Airbnb',
          statut: 'MANQUANT DANS LODGIFY',
          alerte: '⚠️ Paiement Airbnb sans réservation Lodgify',
          type: 'airbnb-only'
        });
      }
    });

    // 4. Ajouter les lignes "aucun détail" à la fin
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
          site: 'Airbnb',
          statut: 'SANS DÉTAIL',
          alerte: '',
          type: 'no-detail'
        });
      });
    }

    // 5. Trier : par appartement puis par date d'arrivée
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
    
    const headers = ['Appartement', 'Arrivée', 'Départ', 'Client', 'Code Réservation', 'Montant', 'Nb Paiements', 'Site/OTA', 'Statut', 'Alerte'];
    const csv = [
      headers.join(';'),
      ...fusedData.map(r => [
        `"${r.appartement}"`,
        r.arrivee,
        r.depart,
        `"${r.client}"`,
        r.codeResa,
        r.montantFinal.toFixed(2) + '€',
        r.nbPaiements > 1 ? r.nbPaiements : '',
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
          <img 
            src="https://l.icdbcdn.com/oh/4ba79e21-32a0-45a0-90ea-1ab3b2c2f813.png?w=400" 
            alt="CityCosy Logo" 
            className="h-20 mx-auto mb-6"
          />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Aide Comptabilité
          </h1>
          <p className="text-lg text-gray-600">Fusion intelligente Lodgify + Airbnb</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-600 mb-4">📘 Lodgify (Réservations)</h2>
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
            <h2 className="text-2xl font-bold text-pink-600 mb-4">💰 Airbnb (Versements)</h2>
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
                        <td className="px-3 py-3 text-right font-bold text-gray-900">{row.montantFinal.toFixed(2)}€</td>
                        <td className="px-3 py-3 text-center">
                          {row.nbPaiements > 1 && (
                            <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                              {row.nbPaiements}x
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            row.site === 'Airbnb' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'
                          }`}>
                            {row.site}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            row.statut === 'PAYÉ' ? 'bg-green-100 text-green-800' :
                            row.statut === 'SANS DÉTAIL' ? 'bg-gray-200 text-gray-700' :
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
