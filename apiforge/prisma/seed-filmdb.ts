import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎬 Seeding CineVault film database...');

  // ── User & Project ──────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'admin@cinevault.com' },
    update: {},
    create: { email: 'admin@cinevault.com' },
  });

  const existing = await prisma.project.findUnique({ where: { slug: 'cinevault' } });
  if (existing) {
    console.log('Project already exists, deleting and recreating...');
    await prisma.project.delete({ where: { id: existing.id } });
  }

  const project = await prisma.project.create({
    data: { userId: user.id, name: 'CineVault', slug: 'cinevault' },
  });
  console.log(`✓ Project: ${project.name}`);

  // ── Collections ─────────────────────────────────────────────────────────────
  const makeCollection = (name: string, slug: string) =>
    prisma.collection.create({
      data: { projectId: project.id, name, slug, visibility: 'public' },
    });

  const [genresCol, directorsCol, actorsCol, moviesCol, reviewsCol] = await Promise.all([
    makeCollection('Genres', 'genres'),
    makeCollection('Directors', 'directors'),
    makeCollection('Actors', 'actors'),
    makeCollection('Movies', 'movies'),
    makeCollection('Reviews', 'reviews'),
  ]);
  console.log('✓ Collections created');

  // ── Fields ──────────────────────────────────────────────────────────────────
  const makeField = (collectionId: string, name: string, type: string, position: number, extra: object = {}) =>
    prisma.field.create({ data: { collectionId, name, type, position, required: false, ...extra } });

  await Promise.all([
    // Genres
    makeField(genresCol.id, 'name', 'string', 0, { required: true }),
    makeField(genresCol.id, 'slug', 'string', 1),
    makeField(genresCol.id, 'description', 'text', 2),
    makeField(genresCol.id, 'color', 'string', 3),

    // Directors
    makeField(directorsCol.id, 'name', 'string', 0, { required: true }),
    makeField(directorsCol.id, 'bio', 'richtext', 1),
    makeField(directorsCol.id, 'birthDate', 'date', 2),
    makeField(directorsCol.id, 'nationality', 'string', 3),
    makeField(directorsCol.id, 'awardsCount', 'integer', 4),

    // Actors
    makeField(actorsCol.id, 'name', 'string', 0, { required: true }),
    makeField(actorsCol.id, 'bio', 'richtext', 1),
    makeField(actorsCol.id, 'birthDate', 'date', 2),
    makeField(actorsCol.id, 'nationality', 'string', 3),
    makeField(actorsCol.id, 'knownFor', 'string', 4),

    // Movies
    makeField(moviesCol.id, 'title', 'string', 0, { required: true }),
    makeField(moviesCol.id, 'tagline', 'string', 1),
    makeField(moviesCol.id, 'synopsis', 'richtext', 2),
    makeField(moviesCol.id, 'releaseDate', 'date', 3),
    makeField(moviesCol.id, 'runtime', 'integer', 4),
    makeField(moviesCol.id, 'rating', 'float', 5),
    makeField(moviesCol.id, 'budget', 'integer', 6),
    makeField(moviesCol.id, 'trailerUrl', 'string', 7),
    makeField(moviesCol.id, 'language', 'string', 8),
    makeField(moviesCol.id, 'status', 'enum', 9, { enumValues: ['released', 'upcoming', 'in-production'] }),

    // Reviews
    makeField(reviewsCol.id, 'title', 'string', 0, { required: true }),
    makeField(reviewsCol.id, 'content', 'richtext', 1),
    makeField(reviewsCol.id, 'score', 'integer', 2),
    makeField(reviewsCol.id, 'authorName', 'string', 3),
    makeField(reviewsCol.id, 'reviewDate', 'date', 4),
    makeField(reviewsCol.id, 'verified', 'boolean', 5),
  ]);
  console.log('✓ Fields created');

  // ── Relations ───────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.relation.create({ data: { collectionId: moviesCol.id, fieldName: 'directorId', relationType: 'one_to_one', targetCollectionId: directorsCol.id } }),
    prisma.relation.create({ data: { collectionId: moviesCol.id, fieldName: 'genreIds', relationType: 'many_to_many', targetCollectionId: genresCol.id } }),
    prisma.relation.create({ data: { collectionId: moviesCol.id, fieldName: 'castIds', relationType: 'many_to_many', targetCollectionId: actorsCol.id } }),
    prisma.relation.create({ data: { collectionId: reviewsCol.id, fieldName: 'movieId', relationType: 'one_to_one', targetCollectionId: moviesCol.id } }),
  ]);
  console.log('✓ Relations created');

  // ── Records ─────────────────────────────────────────────────────────────────
  const makeRecord = (collectionId: string, data: object) =>
    prisma.record.create({ data: { projectId: project.id, collectionId, data } });

  // Genres
  const [actionG, dramaG, scifiG, thrillerG, comedyG, crimeG] = await Promise.all([
    makeRecord(genresCol.id, { name: 'Action', slug: 'action', description: 'High-octane films featuring stunts, fights and explosive set pieces.', color: '#ef4444' }),
    makeRecord(genresCol.id, { name: 'Drama', slug: 'drama', description: 'Character-driven stories exploring human emotion and conflict.', color: '#6366f1' }),
    makeRecord(genresCol.id, { name: 'Sci-Fi', slug: 'sci-fi', description: 'Speculative fiction grounded in science and futuristic concepts.', color: '#06b6d4' }),
    makeRecord(genresCol.id, { name: 'Thriller', slug: 'thriller', description: 'Suspenseful films designed to keep audiences on the edge of their seats.', color: '#f59e0b' }),
    makeRecord(genresCol.id, { name: 'Comedy', slug: 'comedy', description: 'Films designed to entertain and provoke laughter.', color: '#22c55e' }),
    makeRecord(genresCol.id, { name: 'Crime', slug: 'crime', description: 'Stories revolving around criminal acts and their consequences.', color: '#8b5cf6' }),
  ]);
  console.log('✓ Genres seeded');

  // Directors
  const [nolan, villeneuve, scorsese, gerwig, fincher] = await Promise.all([
    makeRecord(directorsCol.id, { name: 'Christopher Nolan', bio: '<p>Christopher Edward Nolan is a British-American filmmaker known for his complex, nonlinear storytelling. Born in London in 1970, he studied English Literature at Cambridge before breaking into film with <em>Following</em> (1998).</p><p>His work consistently blurs the boundary between art-house and blockbuster cinema, earning him both critical acclaim and massive commercial success.</p>', birthDate: '1970-07-30', nationality: 'British-American', awardsCount: 11 }),
    makeRecord(directorsCol.id, { name: 'Denis Villeneuve', bio: '<p>Denis Villeneuve is a Canadian filmmaker celebrated for his visually stunning and philosophically rich science fiction epics. Born in Quebec in 1967, he began his career with French-language films before gaining international recognition with <em>Incendies</em> (2010).</p><p>His meticulous approach to world-building and his collaboration with cinematographer Greig Fraser have produced some of the most visually arresting films of the 2010s and 2020s.</p>', birthDate: '1967-10-03', nationality: 'Canadian', awardsCount: 8 }),
    makeRecord(directorsCol.id, { name: 'Martin Scorsese', bio: '<p>Martin Charles Scorsese is an American filmmaker widely regarded as one of the greatest directors in cinema history. Born in New York City in 1942, he grew up in Little Italy and drew on his surroundings to craft gritty, visceral portraits of crime and moral ambiguity.</p><p>A passionate cinephile, Scorsese is also renowned for his work preserving film history through the Film Foundation.</p>', birthDate: '1942-11-17', nationality: 'American', awardsCount: 24 }),
    makeRecord(directorsCol.id, { name: 'Greta Gerwig', bio: '<p>Greta Celeste Gerwig is an American actress, screenwriter and director known for her sharp wit, feminist perspective and deeply humanistic storytelling. Born in Sacramento in 1983, she rose to prominence as an actress in mumblecore films before transitioning to directing.</p><p>Her debut <em>Lady Bird</em> (2017) earned five Academy Award nominations, establishing her as one of Hollywood\'s most vital voices.</p>', birthDate: '1983-08-04', nationality: 'American', awardsCount: 7 }),
    makeRecord(directorsCol.id, { name: 'David Fincher', bio: '<p>David Andrew Leo Fincher is an American filmmaker known for his dark, meticulous and technically precise thrillers. Born in Denver in 1962, he honed his craft directing music videos and commercials before making his feature debut.</p><p>His films are defined by their cold aesthetic, unreliable narrators and obsessive attention to detail — often requiring dozens of takes to achieve the exact effect he envisions.</p>', birthDate: '1962-08-28', nationality: 'American', awardsCount: 6 }),
  ]);
  console.log('✓ Directors seeded');

  // Actors
  const [dicaprio, murphy, robbie, gosling, chalamet, zendaya, deniro, blunt, pugh, driver, phoenix, deArmas, pitt, damon, hardy] = await Promise.all([
    makeRecord(actorsCol.id, { name: 'Leonardo DiCaprio', bio: '<p>Leonardo Wilhelm DiCaprio is an American actor and producer with a career spanning over three decades. Known for his intense preparation and transformative performances, he has worked with directors including Scorsese, Tarantino and Nolan.</p>', birthDate: '1974-11-11', nationality: 'American', knownFor: 'Titanic, The Revenant, Inception' }),
    makeRecord(actorsCol.id, { name: 'Cillian Murphy', bio: '<p>Cillian Murphy is an Irish actor renowned for his striking blue eyes and ability to portray complex, morally ambiguous characters. He gained widespread fame as Tommy Shelby in Peaky Blinders before winning the Academy Award for Best Actor for Oppenheimer.</p>', birthDate: '1976-05-25', nationality: 'Irish', knownFor: 'Peaky Blinders, Oppenheimer, 28 Days Later' }),
    makeRecord(actorsCol.id, { name: 'Margot Robbie', bio: '<p>Margot Elise Robbie is an Australian actress and producer who became a global star through her memorable performances in The Wolf of Wall Street and Suicide Squad. Her production company LuckyChap Entertainment champions female-led stories.</p>', birthDate: '1990-07-02', nationality: 'Australian', knownFor: 'Barbie, I, Tonya, The Wolf of Wall Street' }),
    makeRecord(actorsCol.id, { name: 'Ryan Gosling', bio: '<p>Ryan Thomas Gosling is a Canadian actor who first gained recognition as a child performer before transitioning to dramatic roles in films like The Notebook and Half Nelson. His versatility across drama, comedy and action has made him one of Hollywood\'s most bankable stars.</p>', birthDate: '1980-11-12', nationality: 'Canadian', knownFor: 'La La Land, Drive, Blade Runner 2049' }),
    makeRecord(actorsCol.id, { name: 'Timothée Chalamet', bio: '<p>Timothée Hal Chalamet is a French-American actor who became the youngest Best Actor Oscar nominee in 80 years at age 22 for Call Me by Your Name. His chameleonic range and magnetic screen presence have established him as the defining young actor of his generation.</p>', birthDate: '1995-12-27', nationality: 'French-American', knownFor: 'Dune, Call Me by Your Name, Little Women' }),
    makeRecord(actorsCol.id, { name: 'Zendaya', bio: '<p>Zendaya Maree Stoermer Coleman is an American actress and singer who transitioned from Disney Channel fame to acclaimed dramatic roles. Her portrayal of Rue in Euphoria made her the youngest Emmy winner for Outstanding Lead Actress in a Drama Series.</p>', birthDate: '1996-09-01', nationality: 'American', knownFor: 'Dune, Euphoria, Spider-Man' }),
    makeRecord(actorsCol.id, { name: 'Robert De Niro', bio: '<p>Robert Anthony De Niro Jr. is an American actor widely considered one of the greatest of all time. His collaboration with Martin Scorsese produced some of cinema\'s most iconic performances, including Travis Bickle in Taxi Driver and Jake LaMotta in Raging Bull.</p>', birthDate: '1943-08-17', nationality: 'American', knownFor: 'The Godfather Part II, Taxi Driver, Goodfellas' }),
    makeRecord(actorsCol.id, { name: 'Emily Blunt', bio: '<p>Emily Olivia Leah Blunt is a British actress celebrated for her remarkable range across genres. From period dramas to action blockbusters, her precise technique and effortless charisma have earned her consistent award recognition throughout her career.</p>', birthDate: '1983-02-23', nationality: 'British', knownFor: 'Oppenheimer, A Quiet Place, The Devil Wears Prada' }),
    makeRecord(actorsCol.id, { name: 'Florence Pugh', bio: '<p>Florence Rose Pugh is a British actress known for her fearless, fully committed performances. She burst onto the international scene with Lady Macbeth before earning an Academy Award nomination for Little Women and becoming a Marvel superhero in Black Widow.</p>', birthDate: '1996-01-03', nationality: 'British', knownFor: 'Oppenheimer, Midsommar, Little Women' }),
    makeRecord(actorsCol.id, { name: 'Adam Driver', bio: '<p>Adam Rand Driver is an American actor and United States Marine Corps veteran. His intense physicality and emotional rawness have made him one of the most compelling actors working today, with acclaimed work ranging from Star Wars to Marriage Story.</p>', birthDate: '1983-11-19', nationality: 'American', knownFor: 'Marriage Story, Star Wars, BlacKkKlansman' }),
    makeRecord(actorsCol.id, { name: 'Joaquin Phoenix', bio: '<p>Joaquin Rafael Phoenix is an American actor known for his deeply immersive, method approach to his craft. A three-time Academy Award nominee before winning for Joker, he is celebrated for his willingness to take extreme physical and psychological risks for a role.</p>', birthDate: '1974-10-28', nationality: 'American', knownFor: 'Joker, Her, Walk the Line' }),
    makeRecord(actorsCol.id, { name: 'Ana de Armas', bio: '<p>Ana Celia de Armas Caso is a Cuban-Spanish actress who trained at the National Theatre School of Cuba before building an international career. Her breakthrough in Knives Out and Blade Runner 2049 led to her first leading role in Blonde opposite Nick Cassavetes.</p>', birthDate: '1988-04-30', nationality: 'Cuban-Spanish', knownFor: 'Knives Out, Blade Runner 2049, No Time to Die' }),
    makeRecord(actorsCol.id, { name: 'Brad Pitt', bio: '<p>William Bradley Pitt is an American actor and film producer who has become one of the most recognizable film stars in the world. Known equally for his striking looks and genuine acting ability, he won the Academy Award for Once Upon a Time in Hollywood.</p>', birthDate: '1963-12-18', nationality: 'American', knownFor: 'Fight Club, Se7en, Once Upon a Time in Hollywood' }),
    makeRecord(actorsCol.id, { name: 'Matt Damon', bio: '<p>Matthew Paige Damon is an American actor and screenwriter who first came to prominence by co-writing and starring in Good Will Hunting, for which he won the Academy Award for Best Original Screenplay. His everyman quality and natural charisma have made him one of Hollywood\'s most reliable leading men.</p>', birthDate: '1970-10-08', nationality: 'American', knownFor: 'Good Will Hunting, The Departed, The Martian' }),
    makeRecord(actorsCol.id, { name: 'Tom Hardy', bio: '<p>Edward Thomas Hardy CBE is an English actor known for his chameleonic ability to physically transform himself for roles. Whether bulking up to play Bane or creating an entirely new physicality as Venom, Hardy consistently disappears into his characters.</p>', birthDate: '1977-09-15', nationality: 'British', knownFor: 'Mad Max: Fury Road, Inception, The Dark Knight Rises' }),
  ]);
  console.log('✓ Actors seeded');

  // Movies
  const [inception, oppenheimer, dune2, barbie, departed, blade2049, interstellar, wolf] = await Promise.all([
    makeRecord(moviesCol.id, {
      title: 'Inception', tagline: 'Your mind is the scene of the crime.',
      synopsis: '<p>Dom Cobb is a skilled thief, the absolute best in the dangerous art of extraction: stealing valuable secrets from deep within the subconscious during the dream state, when the mind is at its most vulnerable.</p><p>Cobb\'s rare ability has made him a coveted player in this treacherous new world of corporate espionage, but it has also made him an international fugitive and cost him everything he has ever loved.</p><p>Now Cobb is being offered a chance at redemption. One last job could give him his life back, but only if he can accomplish the impossible — <em>inception</em>.</p>',
      releaseDate: '2010-07-16', runtime: 148, rating: 8.8, budget: 160, trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0', language: 'English', status: 'released',
      directorId: nolan.id, genreIds: [actionG.id, scifiG.id, thrillerG.id], castIds: [dicaprio.id, hardy.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'Oppenheimer', tagline: 'The world forever changes.',
      synopsis: '<p>The story of J. Robert Oppenheimer\'s role in the development of the atomic bomb during World War II. Based on the Pulitzer Prize-winning book <em>American Prometheus</em>, the film explores the brilliant theoretical physicist who led the Manhattan Project and later struggled with the moral consequences of his creation.</p><p>Told through a fractured timeline spanning decades, the film is both a portrait of genius and a meditation on the nature of responsibility.</p>',
      releaseDate: '2023-07-21', runtime: 180, rating: 8.9, budget: 100, trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg', language: 'English', status: 'released',
      directorId: nolan.id, genreIds: [dramaG.id, thrillerG.id], castIds: [murphy.id, blunt.id, pugh.id, damon.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'Dune: Part Two', tagline: 'Long live the fighters.',
      synopsis: '<p>Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the known universe, Paul endeavors to prevent a terrible future only he can foresee.</p><p>The epic continuation of Denis Villeneuve\'s adaptation of Frank Herbert\'s seminal science fiction novel delivers breathtaking spectacle while deepening its exploration of messianic mythology and colonial power.</p>',
      releaseDate: '2024-03-01', runtime: 166, rating: 8.5, budget: 190, trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w', language: 'English', status: 'released',
      directorId: villeneuve.id, genreIds: [scifiG.id, actionG.id, dramaG.id], castIds: [chalamet.id, zendaya.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'Barbie', tagline: 'She\'s everything. He\'s just Ken.',
      synopsis: '<p>Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbieland. However, when they get a chance to go to the real world, they soon discover the joys and perils of living among humans.</p><p>A wildly inventive and surprisingly poignant exploration of identity, feminism and what it means to be human — wrapped in hot pink and delivered with gleeful anarchic energy.</p>',
      releaseDate: '2023-07-21', runtime: 114, rating: 6.9, budget: 145, trailerUrl: 'https://www.youtube.com/watch?v=pBk4NYhWNMM', language: 'English', status: 'released',
      directorId: gerwig.id, genreIds: [comedyG.id, dramaG.id], castIds: [robbie.id, gosling.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'The Departed', tagline: 'Cops or criminals. When you\'re facing a loaded gun, what\'s the difference?',
      synopsis: '<p>In South Boston, the state police force is waging war on Irish-American organized crime. Young undercover cop Billy Costigan is assigned to infiltrate the mob syndicate run by gangland chief Frank Costello.</p><p>While Billy costigan is working to gain Costello\'s confidence, fellow cop Colin Sullivan has infiltrated the state police as an informant for Costello. Each man becomes deeply enmeshed in his double life, gathering information about the other\'s undercover activities.</p>',
      releaseDate: '2006-10-06', runtime: 151, rating: 8.5, budget: 90, trailerUrl: 'https://www.youtube.com/watch?v=SGWHNQmfxJ4', language: 'English', status: 'released',
      directorId: scorsese.id, genreIds: [crimeG.id, dramaG.id, thrillerG.id], castIds: [dicaprio.id, damon.id, deniro.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'Blade Runner 2049', tagline: 'The key to the future is finally unearthed.',
      synopsis: '<p>Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what\'s left of society into chaos. K\'s discovery leads him on a quest to find Rick Deckard, a former LAPD blade runner who has been missing for 30 years.</p><p>A visual and philosophical landmark of modern science fiction, the film expands the world of its predecessor while asking deeper questions about the nature of memory, identity and what it means to be human.</p>',
      releaseDate: '2017-10-06', runtime: 164, rating: 8.0, budget: 150, trailerUrl: 'https://www.youtube.com/watch?v=gCcx85zbxz4', language: 'English', status: 'released',
      directorId: villeneuve.id, genreIds: [scifiG.id, dramaG.id, thrillerG.id], castIds: [gosling.id, deArmas.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'Interstellar', tagline: 'Mankind was born on Earth. It was never meant to die here.',
      synopsis: '<p>When Earth\'s future is threatened by a dying planet, a team of explorers and scientists embark on the most important mission in human history: travelling beyond our galaxy to discover whether mankind has a future among the stars.</p><p>A deeply personal story of a father\'s love for his daughter wrapped in one of cinema\'s most ambitious depictions of space travel, time dilation and theoretical physics.</p>',
      releaseDate: '2014-11-07', runtime: 169, rating: 8.6, budget: 165, trailerUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E', language: 'English', status: 'released',
      directorId: nolan.id, genreIds: [scifiG.id, dramaG.id, actionG.id], castIds: [damon.id],
    }),
    makeRecord(moviesCol.id, {
      title: 'The Wolf of Wall Street', tagline: 'Earn. Spend. Party. Repeat.',
      synopsis: '<p>Based on the true story of Jordan Belfort, from his rise to a wealthy stockbroker living the high life to his fall involving crime, corruption and the federal government. The film is a kinetic, darkly comedic examination of greed, excess and the seductive corruption of the American Dream.</p><p>At three hours, Scorsese never lets the energy drop — this is cinema as controlled chaos, intoxicating and repulsive in equal measure.</p>',
      releaseDate: '2013-12-25', runtime: 180, rating: 8.2, budget: 100, trailerUrl: 'https://www.youtube.com/watch?v=iszwuX1AK6A', language: 'English', status: 'released',
      directorId: scorsese.id, genreIds: [dramaG.id, comedyG.id, crimeG.id], castIds: [dicaprio.id, robbie.id, deniro.id],
    }),
  ]);
  console.log('✓ Movies seeded');

  // Reviews
  await Promise.all([
    // Inception
    makeRecord(reviewsCol.id, { title: 'A labyrinthine masterpiece', content: '<p>Nolan has crafted something genuinely rare: a blockbuster that demands active engagement from its audience. The dream-within-a-dream structure could have been confusing, but instead it\'s exhilarating — a puzzle box that rewards attention without punishing confusion.</p><p>DiCaprio anchors the film with quiet grief, and Hans Zimmer\'s iconic score elevates every scene. One of the defining films of the 2010s.</p>', score: 10, authorName: 'Marcus Webb', reviewDate: '2010-08-01', verified: true, movieId: inception.id }),
    makeRecord(reviewsCol.id, { title: 'Technically dazzling, emotionally cool', content: '<p>There\'s no denying the craft on display here. The rotating corridor fight sequence alone is worth the price of admission. But for all its ingenuity, Inception keeps its emotional core at arm\'s length — I admired it enormously without ever being moved by it.</p><p>A brilliant film, but perhaps not a great one.</p>', score: 8, authorName: 'Sophie Laurent', reviewDate: '2010-09-14', verified: true, movieId: inception.id }),
    makeRecord(reviewsCol.id, { title: 'Rewatchable unlike almost anything else', content: '<p>I\'ve seen Inception seven times and I notice something new every single viewing. The way the rules of dream logic are established and then subverted, the visual motifs, the mirroring of character arcs — it\'s a film built for repeat engagement.</p>', score: 9, authorName: 'Dev Patel', reviewDate: '2022-06-20', verified: false, movieId: inception.id }),

    // Oppenheimer
    makeRecord(reviewsCol.id, { title: 'The most important film of the decade', content: '<p>Oppenheimer is Nolan at his most mature and morally serious. Cillian Murphy disappears entirely into J. Robert Oppenheimer — he doesn\'t act the role so much as inhabit it. The Trinity sequence may be the most awe-inspiring thing I\'ve seen in a cinema.</p><p>That Nolan refuses to show the bombs dropping on Japan is a deliberate and powerful choice — this is Oppenheimer\'s story, told from inside his fractured conscience.</p>', score: 10, authorName: 'Amelia Chen', reviewDate: '2023-07-25', verified: true, movieId: oppenheimer.id }),
    makeRecord(reviewsCol.id, { title: 'Three hours that feel like one', content: '<p>I went in skeptical about the runtime and came out wishing there were more. The courtroom sequences are as tense as any action sequence I\'ve seen this year, and Florence Pugh is devastating in her limited screen time.</p>', score: 9, authorName: 'Tom Richards', reviewDate: '2023-08-10', verified: true, movieId: oppenheimer.id }),
    makeRecord(reviewsCol.id, { title: 'RDJ steals the entire film', content: '<p>Everyone is raving about Murphy — rightly — but Robert Downey Jr\'s Lewis Strauss is the film\'s dark heart. His final scenes land with a gut punch that recontextualises everything that came before. An awards-worthy supporting turn from an actor who seemed to have nothing left to prove.</p>', score: 9, authorName: 'Naomi Price', reviewDate: '2023-09-01', verified: true, movieId: oppenheimer.id }),

    // Dune Part Two
    makeRecord(reviewsCol.id, { title: 'The sci-fi epic we deserved', content: '<p>Where Part One was world-building, Part Two is world-shattering. Villeneuve takes the darker, more complicated second half of Herbert\'s novel and transforms it into something genuinely disturbing — a hero\'s journey that turns into a villain origin story.</p><p>Zendaya finally gets her film, and she absolutely delivers.</p>', score: 9, authorName: 'Carlos Mendez', reviewDate: '2024-03-10', verified: true, movieId: dune2.id }),
    makeRecord(reviewsCol.id, { title: 'Visually unmatched, narratively rushed', content: '<p>The scale is genuinely breathtaking — the Harkonnen arena sequence in black and white is unlike anything in mainstream cinema. But in condensing the back half of Herbert\'s novel, some of the philosophical complexity gets lost.</p><p>Still essential viewing, just not the perfect adaptation I had hoped for.</p>', score: 7, authorName: 'Ellen Park', reviewDate: '2024-03-22', verified: false, movieId: dune2.id }),

    // Barbie
    makeRecord(reviewsCol.id, { title: 'A pop culture reckoning disguised as a toy commercial', content: '<p>Gerwig takes a premise that seemed designed to fail critically and turns it into the most thoughtful film about feminism and identity since Lady Bird. The Kens subplot is a masterpiece of comic misdirection — while you\'re laughing at the patriarchy sketch, the film is quietly doing something far more nuanced.</p>', score: 9, authorName: 'Jessica Moore', reviewDate: '2023-08-05', verified: true, movieId: barbie.id }),
    makeRecord(reviewsCol.id, { title: 'Gosling is the best thing in it', content: '<p>I came for the cultural conversation and stayed for Ryan Gosling\'s performance. He is so committed to the bit, so genuinely funny and yet strangely moving, that he elevates every scene he\'s in. "I\'m Just Ken" is somehow the emotional high point of a film about Barbie.</p>', score: 8, authorName: 'Mike Thompson', reviewDate: '2023-07-30', verified: false, movieId: barbie.id }),

    // The Departed
    makeRecord(reviewsCol.id, { title: 'Scorsese\'s most purely entertaining film', content: '<p>The Departed is a masterclass in tension and misdirection. You know someone is going to die — multiple someones — but you never know when or how, and Scorsese keeps that anxiety simmering throughout every scene.</p><p>The cast is unimprovable. DiCaprio had never been better to this point in his career.</p>', score: 10, authorName: 'Patrick O\'Brien', reviewDate: '2006-11-12', verified: true, movieId: departed.id }),
    makeRecord(reviewsCol.id, { title: 'The ending still haunts me', content: '<p>I will not spoil it but the final ten minutes of The Departed are as audacious and devastating as anything Scorsese has ever done. He turns genre conventions on their head with such casual brutality that you\'re left genuinely shaken.</p>', score: 10, authorName: 'Rachel Kim', reviewDate: '2020-05-14', verified: false, movieId: departed.id }),

    // Blade Runner 2049
    makeRecord(reviewsCol.id, { title: 'A worthy successor and a masterwork in its own right', content: '<p>Blade Runner 2049 is the rare sequel that deepens the original rather than diminishing it. Villeneuve and cinematographer Roger Deakins create a visual language that is both indebted to Ridley Scott\'s 1982 film and entirely its own.</p><p>Gosling\'s performance is beautifully restrained — a study in internalised longing that the film earns through patience and faith in its audience.</p>', score: 10, authorName: 'David Nakamura', reviewDate: '2017-10-20', verified: true, movieId: blade2049.id }),
    makeRecord(reviewsCol.id, { title: 'Too slow for some, perfect for others', content: '<p>I understand why general audiences found this challenging — it is two hours and forty-four minutes of near-silent atmosphere punctuated by brief moments of action. But for those on its wavelength, it\'s hypnotic. Ana de Armas as Joi is heartbreaking.</p>', score: 8, authorName: 'Sarah Collins', reviewDate: '2017-11-08', verified: true, movieId: blade2049.id }),

    // Interstellar
    makeRecord(reviewsCol.id, { title: 'Weeps at the stars', content: '<p>Interstellar has flaws — the dialogue occasionally explains what the visuals already communicate, and the finale strains credulity even for a film about wormholes. But when it works, it works on a level that bypasses the intellect entirely.</p><p>The docking sequence. The water planet. Cooper\'s video messages. These scenes will stay with me forever.</p>', score: 9, authorName: 'Linda Foster', reviewDate: '2014-12-01', verified: true, movieId: interstellar.id }),

    // Wolf of Wall Street
    makeRecord(reviewsCol.id, { title: 'Complicity as critique', content: '<p>The Wolf of Wall Street is frequently misread as glorifying its subject. It is doing the opposite — by making Belfort\'s lifestyle so seductive and the film so relentlessly entertaining, Scorsese implicates the audience in exactly the same way the real Belfort implicated his investors.</p><p>DiCaprio has never been more charismatic or more repellent simultaneously.</p>', score: 9, authorName: 'James Chen', reviewDate: '2014-01-15', verified: true, movieId: wolf.id }),
    makeRecord(reviewsCol.id, { title: 'Three hours of beautiful excess', content: '<p>There are sequences in Wolf of Wall Street that belong in any discussion of the best cinema of the 2010s. The Quaalude scene. The FBI agent on the subway. Margot Robbie\'s monologue at the top of the stairs. It\'s a film that could only have been made by someone who has spent a lifetime thinking about morality, money and movies.</p>', score: 10, authorName: 'Anna Schultz', reviewDate: '2014-02-28', verified: false, movieId: wolf.id }),
  ]);
  console.log('✓ Reviews seeded');

  // ── API Key ──────────────────────────────────────────────────────────────────
  // Create a read-only API key for testing (note: this bypasses the normal hash flow, for dev only)
  console.log('\n🎬 CineVault seeded successfully!');
  console.log(`   Project ID: ${project.id}`);
  console.log(`   Collections: genres, directors, actors, movies, reviews`);
  console.log(`   Records: 6 genres · 5 directors · 15 actors · 8 movies · 20 reviews`);
  console.log(`\n   Log in as admin@cinevault.com to access the project.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
