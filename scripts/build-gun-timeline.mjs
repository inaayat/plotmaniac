import fs from "node:fs";

const timeline = [
  {
    id: "constitutional-1791-second-amendment",
    year: "1791",
    date: "1791-12-15",
    tone: 0,
    kind: "constitutional",
    scope: "federal",
    event: "Second Amendment ratified",
    plainEnglish:
      "The Bill of Rights includes the Second Amendment: “A well regulated Militia, being necessary to the security of a free State, the right of the people to keep and bear Arms, shall not be infringed.” Later cases—not this text alone—define how that applies to federal and state regulation.",
    links: [
      {
        label: "National Archives — Bill of Rights transcript",
        url: "https://www.archives.gov/founding-docs/bill-of-rights-transcript",
        primary: true,
      },
    ],
  },
  {
    id: "constitutional-1868-fourteenth-amendment",
    year: "1868",
    date: "1868-07-09",
    tone: 0,
    kind: "constitutional",
    scope: "federal",
    event: "Fourteenth Amendment ratified",
    plainEnglish:
      "The Fourteenth Amendment guarantees due process and equal protection. It later becomes the vehicle for applying parts of the Bill of Rights—including the Second Amendment—to state and local governments, but that incorporation develops through twentieth-century litigation, not instantly in 1868.",
    links: [
      {
        label: "National Archives — Fourteenth Amendment transcript",
        url: "https://www.archives.gov/milestone-documents/14th-amendment",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-1876-cruikshank",
    year: "1876",
    date: "1876-03-27",
    tone: 0,
    kind: "scotus",
    scope: "federal",
    event: "United States v. Cruikshank",
    plainEnglish:
      "The Court held the Second Amendment restricts only the federal government, not private actors, and that the federal government could not rely on the Amendment alone to charge individuals for interfering with others’ arms. It did not create a modern individual-rights test for all gun regulation.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/92pdf/92-1101.pdf",
        primary: true,
      },
      {
        label: "Justia case text",
        url: "https://supreme.justia.com/cases/federal/us/92/542/",
      },
    ],
  },
  {
    id: "scotus-1886-presser",
    year: "1886",
    date: "1886-01-04",
    tone: 0,
    kind: "scotus",
    scope: "federal",
    event: "Presser v. Illinois",
    plainEnglish:
      "The Court upheld Illinois’s restriction on private military organizations parading with arms, treating the Second Amendment as tied to militia service and not a license for armed private armies. The decision addressed state police power more than ordinary civilian ownership rules.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/116pdf/110-0310.pdf",
        primary: true,
      },
      {
        label: "Justia case text",
        url: "https://supreme.justia.com/cases/federal/us/116/252/",
      },
    ],
  },
  {
    id: "statute-1934-nfa",
    year: "1934",
    date: "1934-06-26",
    tone: 2,
    kind: "statute",
    scope: "federal",
    event: "National Firearms Act",
    plainEnglish:
      "Congress taxes and registers certain firearms and accessories—machine guns, short-barreled rifles and shotguns, silencers, and related items—through the NFA framework enforced with the tax and registration requirements familiar today.",
    links: [
      {
        label: "Statutes at Large (48 Stat. 1236)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-48/pdf/STATUTE-48-Pg1236.pdf",
        primary: true,
      },
      {
        label: "26 U.S.C. Chapter 53 (NFA)",
        url: "https://uscode.house.gov/view.xhtml?path=/prelim@title26/part1/chapter53&edition=prelim",
      },
    ],
  },
  {
    id: "scotus-1939-miller",
    year: "1939",
    date: "1939-05-15",
    tone: 1,
    kind: "scotus",
    scope: "federal",
    event: "United States v. Miller",
    plainEnglish:
      "Because defendants did not appear, the Court reviewed only the government’s claim that a short-barreled shotgun was not protected without evidence it was ordinary militia equipment. The narrow record limits how far later courts can read Miller as a general rule about all firearms.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/36pdf/696.pdf",
        primary: true,
      },
      {
        label: "Oyez case record",
        url: "https://www.oyez.org/cases/1900-1940/307us174",
      },
    ],
  },
  {
    id: "statute-1968-gca",
    year: "1968",
    date: "1968-10-22",
    tone: 2,
    kind: "statute",
    scope: "federal",
    event: "Gun Control Act",
    plainEnglish:
      "The Gun Control Act creates the federal firearms licensee system, prohibits sales to certain categories of people, sets age floors for dealers, and structures interstate commerce in firearms—establishing the modern federal enforcement baseline.",
    links: [
      {
        label: "Pub. L. 90-618 (82 Stat. 1213)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-82/pdf/STATUTE-82-Pg1213.pdf",
        primary: true,
      },
      {
        label: "18 U.S.C. Chapter 44",
        url: "https://uscode.house.gov/view.xhtml?path=/prelim@title18/part1/chapter44&edition=prelim",
      },
    ],
  },
  {
    id: "statute-1986-fopa",
    year: "1986",
    date: "1986-05-19",
    tone: -1,
    kind: "statute",
    scope: "federal",
    event: "Firearm Owners’ Protection Act",
    plainEnglish:
      "FOPA loosens some federal restrictions—most famously limiting new civilian machine-gun registrations after 1986—while also adding protections for lawful travel and adjusting dealer inspection rules.",
    links: [
      {
        label: "Pub. L. 99-308 (100 Stat. 449)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-100/pdf/STATUTE-100-Pg449.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "statute-1993-brady",
    year: "1993",
    date: "1993-11-30",
    tone: 1,
    kind: "statute",
    scope: "federal",
    event: "Brady Handgun Violence Prevention Act",
    plainEnglish:
      "The Brady Act requires federally licensed dealers to run background checks and creates an interim waiting period until the national instant-check system could replace it.",
    links: [
      {
        label: "Pub. L. 103-159 (107 Stat. 1536)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-107/pdf/STATUTE-107-Pg1536.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "agency-1998-nics",
    year: "1998",
    date: "1998-11-30",
    tone: 1,
    kind: "agency",
    scope: "federal",
    event: "NICS begins operating",
    plainEnglish:
      "The FBI’s National Instant Criminal Background Check System starts handling dealer checks nationwide, replacing the Brady interim waiting-period regime for most dealer sales.",
    links: [
      {
        label: "FBI NICS overview",
        url: "https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/nics",
        primary: true,
      },
    ],
  },
  {
    id: "statute-1994-awb",
    year: "1994",
    date: "1994-09-13",
    tone: 2,
    kind: "statute",
    scope: "federal",
    event: "Federal assault-weapons and magazine ban",
    plainEnglish:
      "Congress bans manufacturing certain semi-automatic rifles with listed features and new magazines over ten rounds, with a ten-year sunset clause. State assault-weapon laws are separate tracks.",
    links: [
      {
        label: "Pub. L. 103-322 (108 Stat. 1796)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-108/pdf/STATUTE-108-Pg1796.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "statute-1996-lautenberg",
    year: "1996",
    date: "1996-09-30",
    tone: 1,
    kind: "statute",
    scope: "federal",
    event: "Lautenberg domestic-violence amendment",
    plainEnglish:
      "Federal law expands firearm prohibitions to include misdemeanor crimes of domestic violence and certain protective orders, enforced through the same prohibited-person framework as felonies.",
    links: [
      {
        label: "Pub. L. 104-208 (110 Stat. 3009-365)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-110/pdf/STATUTE-110-Pg3009-365.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "statute-2004-awb-sunset",
    year: "2004",
    date: "2004-09-13",
    tone: -1,
    kind: "statute",
    scope: "federal",
    event: "Federal assault-weapons ban sunsets",
    plainEnglish:
      "The 1994 federal assault-weapons and large-capacity magazine restrictions expire by their own sunset clause when Congress does not renew them, returning federal law to pre-ban baselines while many states keep their own bans.",
    links: [
      {
        label: "Congressional Research Service — AWB sunset context",
        url: "https://crsreports.congress.gov/product/pdf/R/R42699",
        primary: true,
      },
    ],
  },
  {
    id: "statute-2005-plcaa",
    year: "2005",
    date: "2005-10-26",
    tone: -1,
    kind: "statute",
    scope: "federal",
    event: "Protection of Lawful Commerce in Arms Act",
    plainEnglish:
      "PLCAA shields firearms manufacturers and dealers from many civil lawsuits arising from criminal misuse of their products, with exceptions for defective products and certain knowing violations of law.",
    links: [
      {
        label: "Pub. L. 109-92 (119 Stat. 2095)",
        url: "https://www.govinfo.gov/content/pkg/STATUTE-119/pdf/STATUTE-119-Pg2095.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2008-heller",
    year: "2008",
    date: "2008-06-26",
    tone: -2,
    kind: "scotus",
    scope: "federal",
    event: "District of Columbia v. Heller",
    plainEnglish:
      "The Court held the Second Amendment protects an individual right to possess a handgun in the home for self-defense in federal enclaves like D.C., while stressing the right is not unlimited and listing categories of presumptively lawful regulation.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/07pdf/07-290.pdf",
        primary: true,
      },
      {
        label: "Justia case text",
        url: "https://supreme.justia.com/cases/federal/us/554/570/",
      },
      {
        label: "Oyez case record",
        url: "https://www.oyez.org/cases/2007/07-290",
      },
    ],
  },
  {
    id: "scotus-2009-hayes",
    year: "2009",
    date: "2009-02-24",
    tone: 1,
    kind: "scotus",
    scope: "federal",
    event: "United States v. Hayes",
    plainEnglish:
      "The Court upheld applying the Lautenberg domestic-violence firearm prohibition to misdemeanor domestic-violence convictions even when the underlying statute was not labeled a “domestic violence” crime, focusing on the conduct proved at trial.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/08pdf/07-608.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2010-mcdonald",
    year: "2010",
    date: "2010-06-28",
    tone: -2,
    kind: "scotus",
    scope: "federal",
    event: "McDonald v. City of Chicago",
    plainEnglish:
      "The Court held the Second Amendment applies to state and local governments through the Fourteenth Amendment, incorporating the individual self-defense right recognized in Heller against Chicago’s handgun ban.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/09pdf/08-1521.pdf",
        primary: true,
      },
      {
        label: "Oyez case record",
        url: "https://www.oyez.org/cases/2009/08-1521",
      },
    ],
  },
  {
    id: "scotus-2016-caetano",
    year: "2016",
    date: "2016-03-21",
    tone: -1,
    kind: "scotus",
    scope: "federal",
    event: "Caetano v. Massachusetts",
    plainEnglish:
      "In a per curiam decision, the Court reversed a state court that had excluded stun guns from Second Amendment protection merely because they did not exist in 1791, remanding for review under Heller’s framework.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/15pdf/14-10078_1o13.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2016-voisine",
    year: "2016",
    date: "2016-06-27",
    tone: 1,
    kind: "scotus",
    scope: "federal",
    event: "Voisine v. United States",
    plainEnglish:
      "The Court held reckless misdemeanor domestic assaults can trigger the Lautenberg firearm prohibition when they meet the statute’s domestic-violence criteria, rejecting a narrow reading limited to intentional crimes only.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/15pdf/14-10154_8741.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "agency-2018-bump-stock-rule",
    year: "2018",
    date: "2018-12-18",
    tone: 1,
    kind: "agency",
    scope: "federal",
    event: "ATF bump-stock final rule",
    plainEnglish:
      "ATF amends its regulations to treat bump stocks as machine guns under the National Firearms Act and Gun Control Act, banning new sales and requiring destruction or surrender of existing devices.",
    links: [
      {
        label: "Federal Register final rule",
        url: "https://www.federalregister.gov/documents/2018/12/26/2018-27757/bump-stock-type-devices",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2020-nysrpa-nyc",
    year: "2020",
    date: "2020-04-27",
    tone: 0,
    kind: "scotus",
    scope: "federal",
    event: "N.Y. State Rifle & Pistol Ass’n v. City of New York",
    plainEnglish:
      "The Court dismissed the case as moot after New York City changed its transport rule, issuing no merits ruling on public carry. Later Bruen litigation addressed carry licensing on a fresh record.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/19pdf/18-280_f2qg.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "statute-2022-bsca",
    year: "2022",
    date: "2022-06-25",
    tone: 1,
    kind: "statute",
    scope: "federal",
    event: "Bipartisan Safer Communities Act",
    plainEnglish:
      "Congress expands background-check requirements for buyers under 21, clarifies who must register as a federally licensed dealer, and adds state funding for crisis intervention and domestic-violence records in NICS.",
    links: [
      {
        label: "Pub. L. 117-159 (136 Stat. 1310)",
        url: "https://www.govinfo.gov/content/pkg/PLAW-117publ159/pdf/PLAW-117publ159.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2022-bruen",
    year: "2022",
    date: "2022-06-23",
    tone: -2,
    kind: "scotus",
    scope: "federal",
    event: "N.Y. State Rifle & Pistol Ass’n v. Bruen",
    plainEnglish:
      "The Court struck New York’s “proper cause” requirement for public carry licenses and announced a test requiring the government to show a regulation is consistent with the nation’s historical tradition of firearm regulation.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/21pdf/20-843_7j80.pdf",
        primary: true,
      },
      {
        label: "Cornell LII summary",
        url: "https://www.law.cornell.edu/supremecourt/text/20-843",
      },
    ],
  },
  {
    id: "agency-2022-frames-rule",
    year: "2022",
    date: "2022-04-26",
    tone: 1,
    kind: "agency",
    scope: "federal",
    event: "ATF frames and receivers rule",
    plainEnglish:
      "ATF updates definitions so certain unfinished frames and receivers and related kits are treated as firearms for marking, licensing, and background-check purposes, targeting ghost-gun assembly without serial numbers.",
    links: [
      {
        label: "Federal Register final rule",
        url: "https://www.federalregister.gov/documents/2022/04/26/2022-08438/definition-of-frame-or-receiver-and-identification-of-firearms",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2024-rahimi",
    year: "2024",
    date: "2024-06-21",
    tone: 1,
    kind: "scotus",
    scope: "federal",
    event: "United States v. Rahimi",
    plainEnglish:
      "The Court upheld a federal prohibition on firearm possession while a domestic-violence restraining order is in force, finding that disarmament fits within the historical tradition test announced in Bruen for this category of orders.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/23pdf/22-843_m7k0.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "scotus-2024-cargill",
    year: "2024",
    date: "2024-06-14",
    tone: -1,
    kind: "scotus",
    scope: "federal",
    event: "Garland v. Cargill",
    plainEnglish:
      "The Court held bump stocks do not qualify as machine guns under the statutory text, invalidating the ATF rule that had banned them and returning the policy question to Congress unless new legislation passes.",
    links: [
      {
        label: "Supreme Court opinion PDF",
        url: "https://www.supremecourt.gov/opinions/23pdf/22-976_d18e.pdf",
        primary: true,
      },
    ],
  },
  {
    id: "state-1967-ca-mulford",
    year: "1967",
    date: "1967-07-28",
    tone: 2,
    kind: "state",
    scope: "ca",
    event: "California Mulford Act (state landmark)",
    plainEnglish:
      "California bans loaded open carry of firearms in incorporated areas—a state response that tightened public carry rules independently of federal law.",
    links: [
      {
        label: "Cal. Penal Code § 25850 (current codification context)",
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=25850",
        primary: true,
      },
    ],
  },
  {
    id: "state-2013-ny-safe",
    year: "2013",
    date: "2013-01-15",
    tone: 2,
    kind: "state",
    scope: "ny",
    event: "New York SAFE Act (state landmark)",
    plainEnglish:
      "New York expands assault-weapon definitions, magazine limits, and background-check requirements beyond the expired federal ban—a major post-Sandy Hook state tightening.",
    links: [
      {
        label: "N.Y. Senate bill text (S.2230)",
        url: "https://www.nysenate.gov/legislation/bills/2013/S2230",
        primary: true,
      },
    ],
  },
  {
    id: "state-2021-tx-constitutional-carry",
    year: "2021",
    date: "2021-09-01",
    tone: -2,
    kind: "state",
    scope: "tx",
    event: "Texas permitless carry (state landmark)",
    plainEnglish:
      "Texas allows eligible people to carry handguns in public without a license to carry in many places, removing a prior permit requirement for lawful carriers who meet statutory eligibility rules.",
    links: [
      {
        label: "Texas H.B. 1927 enrolled text",
        url: "https://capitol.texas.gov/tlodocs/87R/billtext/html/HB01927F.htm",
        primary: true,
      },
    ],
  },
];

fs.writeFileSync(new URL("../data/gun-regulation/timeline.json", import.meta.url), `${JSON.stringify(timeline, null, 2)}\n`);
console.log(`Wrote ${timeline.length} beats`);
