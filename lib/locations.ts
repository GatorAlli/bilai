// Bangladesh locations for the "where is the cat" pickers.
//
// Two levels, the same shape bikroy.com uses: District (all 64) -> Area.
// Not every place is a city, so a district's areas are its upazilas, plus
// neighbourhoods for the districts that contain a city corporation.
//
// Sources:
// - Upazilas: Bangladesh Bureau of Statistics list (via nuhil/bangladesh-geocode),
//   spellings normalised to the current official romanisation.
// - Neighbourhoods: Wikipedia "Neighbourhoods in the Dhaka metropolitan area",
//   "Neighbourhoods in the Chittagong metropolitan area", and commonly used
//   area names on Bangladeshi listing sites for the other cities.
//
// Stored values are the plain names below, so renaming an entry here will not
// update cats that were already saved with the old name.

export const DIVISIONS = [
  "Barishal",
  "Chattogram",
  "Dhaka",
  "Khulna",
  "Mymensingh",
  "Rajshahi",
  "Rangpur",
  "Sylhet",
] as const;

export type Division = (typeof DIVISIONS)[number];

export type District = {
  name: string;
  division: Division;
  /** Neighbourhoods inside the city corporation, if the district has one. */
  city?: { name: string; areas: readonly string[] };
  upazilas: readonly string[];
};

export type AreaGroup = { value: string; items: string[] };

const RAW_DISTRICTS: District[] = [
  // ── Dhaka division ──────────────────────────────────────────────
  {
    name: "Dhaka",
    division: "Dhaka",
    city: {
      name: "Dhaka city",
      areas: [
        "Abdullahpur", "Adabor", "Aftab Nagar", "Agargaon", "Azimpur",
        "Badda", "Banani", "Banani DOHS", "Banasree", "Bangla Bazar",
        "Bangshal", "Baridhara", "Baridhara DOHS", "Basabo", "Bashundhara",
        "Bawnia", "Beraid", "Bhashantek", "Bochila", "Cantonment",
        "Chawkbazar", "Dakshinkhan", "Demra", "Dhanmondi", "Diabari",
        "Elephant Road", "Eskaton", "Farmgate", "Gabtali", "Gendaria",
        "Gulistan", "Gulshan", "Hatirjheel", "Hazaribagh", "Islampur",
        "Jatrabari", "Jigatola", "Jurain", "Kafrul", "Kakrail", "Kalabagan",
        "Kalshi", "Kamalapur", "Kamrangirchar", "Kawran Bazar", "Kazipara",
        "Khilgaon", "Khilkhet", "Kotwali", "Kuril", "Lalbagh", "Lalmatia",
        "Malibag", "Manikdi", "Matuail", "Mirpur", "Mirpur DOHS",
        "Moghbazar", "Mohakhali", "Mohakhali DOHS", "Mohammadpur",
        "Motijheel", "Mugda", "Nadda", "New Market", "Niketan", "Nikunja",
        "Nimtoli", "Paltan", "Pallabi", "Panthapath", "Paribagh",
        "Ramna", "Rampura", "Rayer Bazar", "Rupnagar", "Sabujbagh",
        "Sadarghat", "Satarkul", "Segunbagicha", "Shahbagh", "Shahjadpur",
        "Shahjahanpur", "Shantinagar", "Sher-e-Bangla Nagar", "Shewrapara",
        "Shonir Akhra", "Shyamoli", "Shyampur", "Siddheswari", "Signboard",
        "Sutrapur", "Tejgaon", "Tejgaon Industrial Area", "Turag", "Uttara",
        "Uttarkhan", "Vatara", "Wari",
      ],
    },
    upazilas: [
      "Ashulia", "Birulia", "Dhamrai", "Dohar", "Hasnabad", "Jinjira",
      "Keraniganj", "Nawabganj", "Savar",
    ],
  },
  {
    name: "Gazipur",
    division: "Dhaka",
    city: {
      name: "Gazipur city",
      areas: [
        "Basan", "Board Bazar", "Chandra", "Gazipur Chowrasta", "Joydebpur",
        "Kashimpur", "Konabari", "Pubail", "Tongi",
      ],
    },
    upazilas: ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"],
  },
  {
    name: "Narayanganj",
    division: "Dhaka",
    city: {
      name: "Narayanganj city",
      areas: ["Chashara", "Fatullah", "Kanchpur", "Siddhirganj"],
    },
    upazilas: [
      "Araihazar", "Bandar", "Narayanganj Sadar", "Purbachal", "Rupganj",
      "Sonargaon",
    ],
  },
  {
    name: "Narsingdi",
    division: "Dhaka",
    upazilas: ["Belabo", "Monohardi", "Narsingdi Sadar", "Palash", "Raipura", "Shibpur"],
  },
  {
    name: "Tangail",
    division: "Dhaka",
    upazilas: [
      "Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur",
      "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Tangail Sadar",
    ],
  },
  {
    name: "Kishoreganj",
    division: "Dhaka",
    upazilas: [
      "Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj",
      "Katiadi", "Kishoreganj Sadar", "Kuliarchar", "Mithamain", "Nikli",
      "Pakundia", "Tarail",
    ],
  },
  {
    name: "Manikganj",
    division: "Dhaka",
    upazilas: [
      "Daulatpur", "Ghior", "Harirampur", "Manikganj Sadar", "Saturia",
      "Shibalaya", "Singair",
    ],
  },
  {
    name: "Munshiganj",
    division: "Dhaka",
    upazilas: [
      "Gazaria", "Lohajang", "Munshiganj Sadar", "Sirajdikhan", "Sreenagar",
      "Tongibari",
    ],
  },
  {
    name: "Rajbari",
    division: "Dhaka",
    upazilas: ["Baliakandi", "Goalanda", "Kalukhali", "Pangsha", "Rajbari Sadar"],
  },
  {
    name: "Madaripur",
    division: "Dhaka",
    upazilas: ["Dasar", "Kalkini", "Madaripur Sadar", "Rajoir", "Shibchar"],
  },
  {
    name: "Gopalganj",
    division: "Dhaka",
    upazilas: ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"],
  },
  {
    name: "Faridpur",
    division: "Dhaka",
    upazilas: [
      "Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Faridpur Sadar",
      "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha",
    ],
  },
  {
    name: "Shariatpur",
    division: "Dhaka",
    upazilas: [
      "Bhedarganj", "Damudya", "Gosairhat", "Naria", "Shariatpur Sadar", "Zanjira",
    ],
  },

  // ── Chattogram division ─────────────────────────────────────────
  {
    name: "Chattogram",
    division: "Chattogram",
    city: {
      name: "Chattogram city",
      areas: [
        "Agrabad", "Akbarshah", "Alankar", "Anderkilla", "Bahaddarhat",
        "Bakalia", "Bandar", "Bayazid", "Chandgaon", "Chawkbazar", "Dampara",
        "Double Mooring", "EPZ", "Firingee Bazar", "Foy's Lake", "GEC",
        "Halishahar", "Jamal Khan", "Kalurghat", "Kattali", "Khatunganj",
        "Khulshi", "Kotwali", "Lalkhan Bazar", "Mohra", "Muradpur",
        "Nasirabad", "New Market", "Oxygen", "Pahartali", "Panchlaish",
        "Patenga", "Sadarghat", "Sholoshahar",
      ],
    },
    upazilas: [
      "Anwara", "Banshkhali", "Boalkhali", "Chandanaish", "Fatikchhari",
      "Hathazari", "Karnaphuli", "Lohagara", "Mirsharai", "Patiya", "Rangunia",
      "Raozan", "Sandwip", "Satkania", "Sitakunda",
    ],
  },
  {
    name: "Cumilla",
    division: "Chattogram",
    city: {
      name: "Cumilla city",
      areas: [
        "Chawkbazar", "Jhawtola", "Kandirpar", "Kotbari", "Racecourse",
        "Rajganj", "Shashongacha", "Tomsom Bridge",
      ],
    },
    upazilas: [
      "Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram",
      "Cumilla Adarsha Sadar", "Cumilla Sadar Dakshin", "Daudkandi",
      "Debidwar", "Homna", "Laksam", "Lalmai", "Manoharganj", "Meghna",
      "Muradnagar", "Nangalkot", "Titas",
    ],
  },
  {
    name: "Cox's Bazar",
    division: "Chattogram",
    upazilas: [
      "Chakaria", "Cox's Bazar Sadar", "Eidgaon", "Kutubdia", "Maheshkhali",
      "Pekua", "Ramu", "Teknaf", "Ukhia",
    ],
  },
  {
    name: "Feni",
    division: "Chattogram",
    upazilas: [
      "Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram",
      "Sonagazi",
    ],
  },
  {
    name: "Brahmanbaria",
    division: "Chattogram",
    upazilas: [
      "Akhaura", "Ashuganj", "Bancharampur", "Bijoynagar", "Brahmanbaria Sadar",
      "Kasba", "Nabinagar", "Nasirnagar", "Sarail",
    ],
  },
  {
    name: "Noakhali",
    division: "Chattogram",
    upazilas: [
      "Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Kabirhat",
      "Noakhali Sadar", "Senbagh", "Sonaimuri", "Subarnachar",
    ],
  },
  {
    name: "Chandpur",
    division: "Chattogram",
    upazilas: [
      "Chandpur Sadar", "Faridganj", "Haimchar", "Hajiganj", "Kachua",
      "Matlab Dakshin", "Matlab Uttar", "Shahrasti",
    ],
  },
  {
    name: "Lakshmipur",
    division: "Chattogram",
    upazilas: ["Kamalnagar", "Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati"],
  },
  {
    name: "Rangamati",
    division: "Chattogram",
    upazilas: [
      "Baghaichhari", "Barkal", "Belaichhari", "Juraichhari", "Kaptai",
      "Kawkhali", "Langadu", "Naniarchar", "Rajasthali", "Rangamati Sadar",
    ],
  },
  {
    name: "Khagrachhari",
    division: "Chattogram",
    upazilas: [
      "Dighinala", "Guimara", "Khagrachhari Sadar", "Lakshmichhari",
      "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh",
    ],
  },
  {
    name: "Bandarban",
    division: "Chattogram",
    upazilas: [
      "Alikadam", "Bandarban Sadar", "Lama", "Naikhongchhari", "Rowangchhari",
      "Ruma", "Thanchi",
    ],
  },

  // ── Khulna division ─────────────────────────────────────────────
  {
    name: "Khulna",
    division: "Khulna",
    city: {
      name: "Khulna city",
      areas: [
        "Boyra", "Daulatpur", "Gollamari", "Khalishpur", "Khan Jahan Ali",
        "Khulna Sadar", "Labanchara", "Moylapota", "Nirala", "Shibbari",
        "Sonadanga", "Tootpara", "Zero Point",
      ],
    },
    upazilas: [
      "Batiaghata", "Dacope", "Dighalia", "Dumuria", "Koyra", "Paikgachha",
      "Phultala", "Rupsha", "Terokhada",
    ],
  },
  {
    name: "Jashore",
    division: "Khulna",
    upazilas: [
      "Abhaynagar", "Bagherpara", "Chaugachha", "Jashore Sadar", "Jhikargachha",
      "Keshabpur", "Manirampur", "Sharsha",
    ],
  },
  {
    name: "Satkhira",
    division: "Khulna",
    upazilas: [
      "Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Satkhira Sadar",
      "Shyamnagar", "Tala",
    ],
  },
  {
    name: "Bagerhat",
    division: "Khulna",
    upazilas: [
      "Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat",
      "Mongla", "Morrelganj", "Rampal", "Sarankhola",
    ],
  },
  {
    name: "Kushtia",
    division: "Khulna",
    upazilas: [
      "Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Kushtia Sadar", "Mirpur",
    ],
  },
  {
    name: "Jhenaidah",
    division: "Khulna",
    upazilas: [
      "Harinakunda", "Jhenaidah Sadar", "Kaliganj", "Kotchandpur", "Maheshpur",
      "Shailkupa",
    ],
  },
  {
    name: "Magura",
    division: "Khulna",
    upazilas: ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"],
  },
  {
    name: "Narail",
    division: "Khulna",
    upazilas: ["Kalia", "Lohagara", "Narail Sadar"],
  },
  {
    name: "Chuadanga",
    division: "Khulna",
    upazilas: ["Alamdanga", "Chuadanga Sadar", "Damurhuda", "Jibannagar"],
  },
  {
    name: "Meherpur",
    division: "Khulna",
    upazilas: ["Gangni", "Meherpur Sadar", "Mujibnagar"],
  },

  // ── Rajshahi division ───────────────────────────────────────────
  {
    name: "Rajshahi",
    division: "Rajshahi",
    city: {
      name: "Rajshahi city",
      areas: [
        "Binodpur", "Boalia", "Kadirganj", "Kazla", "Laxmipur", "Motihar",
        "Padma Residential Area", "Rajpara", "Sapura", "Shah Makhdum",
        "Shaheb Bazar", "Talaimari", "Uposhohor",
      ],
    },
    upazilas: [
      "Bagha", "Bagmara", "Charghat", "Durgapur", "Godagari", "Mohanpur",
      "Paba", "Puthia", "Tanore",
    ],
  },
  {
    name: "Bogura",
    division: "Rajshahi",
    upazilas: [
      "Adamdighi", "Bogura Sadar", "Dhunat", "Dhupchanchia", "Gabtali",
      "Kahaloo", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur",
      "Shibganj", "Sonatala",
    ],
  },
  {
    name: "Pabna",
    division: "Rajshahi",
    upazilas: [
      "Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi",
      "Pabna Sadar", "Santhia", "Sujanagar",
    ],
  },
  {
    name: "Sirajganj",
    division: "Rajshahi",
    upazilas: [
      "Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Raiganj",
      "Shahjadpur", "Sirajganj Sadar", "Tarash", "Ullahpara",
    ],
  },
  {
    name: "Natore",
    division: "Rajshahi",
    upazilas: [
      "Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Naldanga",
      "Natore Sadar", "Singra",
    ],
  },
  {
    name: "Naogaon",
    division: "Rajshahi",
    upazilas: [
      "Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mohadevpur",
      "Naogaon Sadar", "Niamatpur", "Patnitala", "Porsha", "Raninagar",
      "Sapahar",
    ],
  },
  {
    name: "Joypurhat",
    division: "Rajshahi",
    upazilas: ["Akkelpur", "Joypurhat Sadar", "Kalai", "Khetlal", "Panchbibi"],
  },
  {
    name: "Chapainawabganj",
    division: "Rajshahi",
    upazilas: [
      "Bholahat", "Chapainawabganj Sadar", "Gomastapur", "Nachole", "Shibganj",
    ],
  },

  // ── Sylhet division ─────────────────────────────────────────────
  {
    name: "Sylhet",
    division: "Sylhet",
    city: {
      name: "Sylhet city",
      areas: [
        "Akhalia", "Ambarkhana", "Bagbari", "Chowhatta", "Dargah Mahalla",
        "Kotwali", "Kumarpara", "Majortila", "Mirabazar", "Modina Market",
        "Nayasarak", "Shahjalal Uposhohor", "Shahporan", "Shibganj",
        "Subhanighat", "Subid Bazar", "Tilagor", "Zindabazar",
      ],
    },
    upazilas: [
      "Balaganj", "Beanibazar", "Bishwanath", "Companiganj", "Dakshin Surma",
      "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Kanaighat",
      "Osmani Nagar", "Sylhet Sadar", "Zakiganj",
    ],
  },
  {
    name: "Moulvibazar",
    division: "Sylhet",
    upazilas: [
      "Barlekha", "Juri", "Kamalganj", "Kulaura", "Moulvibazar Sadar",
      "Rajnagar", "Sreemangal",
    ],
  },
  {
    name: "Habiganj",
    division: "Sylhet",
    upazilas: [
      "Ajmiriganj", "Bahubal", "Baniachong", "Chunarughat", "Habiganj Sadar",
      "Lakhai", "Madhabpur", "Nabiganj", "Shaistaganj",
    ],
  },
  {
    name: "Sunamganj",
    division: "Sylhet",
    upazilas: [
      "Bishwambarpur", "Chhatak", "Derai", "Dharmapasha", "Dowarabazar",
      "Jagannathpur", "Jamalganj", "Madhyanagar", "Shalla", "Shantiganj",
      "Sunamganj Sadar", "Tahirpur",
    ],
  },

  // ── Barishal division ───────────────────────────────────────────
  {
    name: "Barishal",
    division: "Barishal",
    city: {
      name: "Barishal city",
      areas: [
        "Alekanda", "Band Road", "Bangla Bazar", "Chawk Bazar", "Kashipur",
        "Kawnia", "Launch Ghat", "Natullabad", "Nobogram Road", "Rupatali",
        "Sadar Road",
      ],
    },
    upazilas: [
      "Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Barishal Sadar",
      "Gournadi", "Hizla", "Mehendiganj", "Muladi", "Wazirpur",
    ],
  },
  {
    name: "Patuakhali",
    division: "Barishal",
    upazilas: [
      "Bauphal", "Dashmina", "Dumki", "Galachipa", "Kalapara", "Kuakata",
      "Mirzaganj", "Patuakhali Sadar", "Rangabali",
    ],
  },
  {
    name: "Bhola",
    division: "Barishal",
    upazilas: [
      "Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan",
      "Manpura", "Tazumuddin",
    ],
  },
  {
    name: "Pirojpur",
    division: "Barishal",
    upazilas: [
      "Bhandaria", "Indurkani", "Kawkhali", "Mathbaria", "Nazirpur",
      "Nesarabad", "Pirojpur Sadar",
    ],
  },
  {
    name: "Barguna",
    division: "Barishal",
    upazilas: ["Amtali", "Bamna", "Barguna Sadar", "Betagi", "Patharghata", "Taltali"],
  },
  {
    name: "Jhalokati",
    division: "Barishal",
    upazilas: ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"],
  },

  // ── Rangpur division ────────────────────────────────────────────
  {
    name: "Rangpur",
    division: "Rangpur",
    city: {
      name: "Rangpur city",
      areas: [
        "College Para", "Dhap", "Jahaj Company More", "Kamal Kachna",
        "Lalbagh", "Mahiganj", "Modern More", "Shapla Chattar",
        "Station Road", "Tajhat",
      ],
    },
    upazilas: [
      "Badarganj", "Gangachara", "Kaunia", "Mithapukur", "Pirgachha",
      "Pirganj", "Rangpur Sadar", "Taraganj",
    ],
  },
  {
    name: "Dinajpur",
    division: "Rangpur",
    upazilas: [
      "Biral", "Birampur", "Birganj", "Bochaganj", "Chirirbandar",
      "Dinajpur Sadar", "Fulbari", "Ghoraghat", "Hakimpur", "Kaharole",
      "Khansama", "Nawabganj", "Parbatipur",
    ],
  },
  {
    name: "Gaibandha",
    division: "Rangpur",
    upazilas: [
      "Fulchhari", "Gaibandha Sadar", "Gobindaganj", "Palashbari",
      "Sadullapur", "Saghata", "Sundarganj",
    ],
  },
  {
    name: "Kurigram",
    division: "Rangpur",
    upazilas: [
      "Bhurungamari", "Char Rajibpur", "Chilmari", "Kurigram Sadar",
      "Nageshwari", "Phulbari", "Rajarhat", "Raumari", "Ulipur",
    ],
  },
  {
    name: "Nilphamari",
    division: "Rangpur",
    upazilas: [
      "Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Nilphamari Sadar", "Saidpur",
    ],
  },
  {
    name: "Lalmonirhat",
    division: "Rangpur",
    upazilas: ["Aditmari", "Hatibandha", "Kaliganj", "Lalmonirhat Sadar", "Patgram"],
  },
  {
    name: "Thakurgaon",
    division: "Rangpur",
    upazilas: ["Baliadangi", "Haripur", "Pirganj", "Ranisankail", "Thakurgaon Sadar"],
  },
  {
    name: "Panchagarh",
    division: "Rangpur",
    upazilas: ["Atwari", "Boda", "Debiganj", "Panchagarh Sadar", "Tetulia"],
  },

  // ── Mymensingh division ─────────────────────────────────────────
  {
    name: "Mymensingh",
    division: "Mymensingh",
    city: {
      name: "Mymensingh city",
      areas: [
        "Akua", "Charpara", "Ganginarpar", "Kachijhuli", "Kewatkhali",
        "Kristopur", "Maskanda", "Notun Bazar", "Shambhuganj", "Town Hall",
      ],
    },
    upazilas: [
      "Bhaluka", "Dhobaura", "Fulbaria", "Gaffargaon", "Gauripur",
      "Haluaghat", "Ishwarganj", "Muktagachha", "Mymensingh Sadar", "Nandail",
      "Phulpur", "Tarakanda", "Trishal",
    ],
  },
  {
    name: "Jamalpur",
    division: "Mymensingh",
    upazilas: [
      "Bakshiganj", "Dewanganj", "Islampur", "Jamalpur Sadar", "Madarganj",
      "Melandaha", "Sarishabari",
    ],
  },
  {
    name: "Netrokona",
    division: "Mymensingh",
    upazilas: [
      "Atpara", "Barhatta", "Durgapur", "Kalmakanda", "Kendua", "Khaliajuri",
      "Madan", "Mohanganj", "Netrokona Sadar", "Purbadhala",
    ],
  },
  {
    name: "Sherpur",
    division: "Mymensingh",
    upazilas: ["Jhenaigati", "Nakla", "Nalitabari", "Sherpur Sadar", "Sreebardi"],
  },
];

const byName = (a: string, b: string) => a.localeCompare(b, "en");

/** All 64 districts, alphabetical. */
export const DISTRICTS: readonly District[] = [...RAW_DISTRICTS].sort((a, b) =>
  byName(a.name, b.name),
);

export const DISTRICT_NAMES: readonly string[] = DISTRICTS.map((d) => d.name);

const districtMap = new Map(DISTRICTS.map((d) => [d.name, d]));

export function getDistrict(name: string): District | undefined {
  return districtMap.get(name);
}

/** A district's areas, grouped as "<City> city" then "Upazilas". */
export function getAreaGroups(districtName: string): AreaGroup[] {
  const district = districtMap.get(districtName);
  if (!district) return [];
  const groups: AreaGroup[] = [];
  if (district.city) {
    groups.push({
      value: district.city.name,
      items: [...district.city.areas].sort(byName),
    });
  }
  groups.push({
    value: district.city ? "Upazilas & outskirts" : "Upazilas",
    items: [...district.upazilas].sort(byName),
  });
  return groups;
}

export function isValidLocation(districtName: string, area: string): boolean {
  const district = districtMap.get(districtName);
  if (!district) return false;
  return (
    district.upazilas.includes(area) ||
    (district.city?.areas.includes(area) ?? false)
  );
}
