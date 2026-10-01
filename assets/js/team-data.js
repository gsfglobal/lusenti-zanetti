/* =========================================================
   I MEDICI — dati della sezione "Chi la segue in studio"
   È l'unico file da modificare per cambiare nomi, testi e foto.
   Contenuti SOLO dai dati forniti dallo studio: niente citazioni,
   numeri di pazienti o anni di esperienza non confermati.

   Campi:
   - name: titolo, nome e cognome (il titolo va su una riga piccola)
   - role: riga breve sotto al nome
   - image: ritratto 720×960 (3:4). Se manca → segnaposto "Foto in arrivo"
   - education: formazione (elenco)
   - areas: ambiti di lavoro (elenco)
   ========================================================= */
window.teamMembers = [
  {
    name: 'Dr.ssa Maria Lusenti',
    role: 'Ha aperto lo studio a Castiglione delle Stiviere nel 1995.',
    image: 'assets/img/dr-maria-lusenti.webp',
    alt: 'Ritratto della Dr.ssa Maria Lusenti',
    education: [
      'Laurea in Medicina e Chirurgia (1989)',
      'Formazione presso la Clinica Odontoiatrica di Brescia',
      'Master biennale di II livello presso l’Ospedale Maxillo-Facciale di Padova'
    ],
    areas: null // [da completare con i vostri dati]
  },
  {
    name: 'Dott. Alessandro Zanetti',
    role: 'Chirurgia orale, implantologia e protesi.',
    image: 'assets/img/dott-alessandro-zanetti.webp',
    alt: 'Ritratto del Dott. Alessandro Zanetti',
    education: [
      'Laurea in Odontoiatria, Università di Brescia (2003)',
      'Per 7 anni ha collaborato con la Clinica Odontoiatrica di Brescia'
    ],
    areas: ['Chirurgia orale', 'Implantologia', 'Protesi']
  }
];

// Medico mostrato per primo (indice nell'elenco)
window.TEAM_START = 0;
