

export interface DatabaseSupplier {
    id: string;
    name: string;
    street: string;
    zip: string;
    city: string;
    nip: string;
    email: string;
    phone?: string;
    contactPerson: string;
}

export const PREDEFINED_SUPPLIERS: DatabaseSupplier[] = [
    {
        id: "s1",
        name: "Stal-Bud Sp. z o.o.",
        street: "ul. Przemysłowa 15",
        zip: "00-123",
        city: "Warszawa",
        nip: "525-000-11-22",
        email: "zamowienia@stalbud.pl",
        phone: "+48 22 123 45 67",
        contactPerson: "Jan Kowalski"
    },
    {
        id: "s2",
        name: "Techno-Regały S.A.",
        street: "al. Logistyczna 4",
        zip: "31-400",
        city: "Kraków",
        nip: "676-123-45-67",
        email: "sales@technoregaly.pl",
        phone: "+48 12 987 65 43",
        contactPerson: "Anna Nowak"
    },
    {
        id: "s3",
        name: "Śruby i Mocowania Partner",
        street: "ul. Warsztatowa 8",
        zip: "80-200",
        city: "Gdańsk",
        nip: "957-888-99-00",
        email: "biuro@sruby-partner.com",
        phone: "500 600 700",
        contactPerson: "Piotr Wiśniewski"
    },
    {
        id: "s4",
        name: "Antresole Systemowe Global",
        street: "ul. Magazynowa 1",
        zip: "60-100",
        city: "Poznań",
        nip: "779-555-44-33",
        email: "kontakt@antresole-global.pl",
        phone: "+48 61 888 22 11",
        contactPerson: "Marek Zając"
    },
    {
        id: "s5",
        name: "Barierki Ochronne PRO",
        street: "ul. Bezpieczna 12",
        zip: "50-300",
        city: "Wrocław",
        nip: "897-222-11-00",
        email: "orders@barierki-pro.pl",
        phone: "601 202 303",
        contactPerson: "Krzysztof Krawczyk"
    }
];