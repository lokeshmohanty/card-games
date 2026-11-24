// guess-what/guess-what-pictures.js — Guess What's pictures, in categories.
//
// Every picture is an emoji (the phone's own emoji font draws it), with its
// name and other names (a clue may not use any of them, and the reveal says
// the first), and three clues the bots give. One line each:
//
//   emoji | name/other name | clue; clue; clue
//
// Only single emoji from Emoji 11 or older (no joined sequences): newer ones
// show as empty boxes on Android 9 and older (review, 2026-11-24), and the
// page names any its phone cannot draw. The pools
// are dealt with no repeats until a category is spent (guess-what-rules.js),
// so the more the better; test-guess-what.mjs checks that no bot clue gives
// its picture away and no emoji appears twice.

(() => {
	const RAW = {
		animals: `
🐶|dog/puppy|barks; man's best friend; fetches sticks
🐱|cat/kitten|meows; purrs; whiskers
🐭|mouse/mice|squeaks; loves cheese; tiny rodent
🐹|hamster|runs in a wheel; cheek pouches; small pet
🐰|rabbit/bunny|long ears; hops; eats carrots
🦊|fox|sly; bushy orange tail; cunning
🐻|bear|hibernates; loves honey; grizzly
🐼|panda|eats bamboo; black and white; China
🐨|koala|eucalyptus; Australia; hugs trees
🐯|tiger|stripes; big cat; national animal of India
🦁|lion|king of the jungle; mane; roars
🐮|cow|moo; gives milk; farm
🐷|pig/piglet|oink; rolls in mud; snout
🐸|frog/toad|ribbit; lily pad; jumps
🐵|monkey|bananas; swings in trees; cheeky
🐔|chicken/hen|lays eggs; clucks; farm bird
🐧|penguin|tuxedo; cannot fly; Antarctica
🦆|duck|quack; pond; webbed feet
🦉|owl|hoots; awake at night; wise
🦇|bat|flies at night; hangs upside down; cave
🐺|wolf|howls; hunts in a pack; full moon
🐗|boar|tusks; wild; forest
🐴|horse/pony|gallops; saddle; neighs
🦄|unicorn|one horn; magical; rainbows
🐝|bee/honeybee|buzz; makes honey; hive
🐛|caterpillar|crawls; turns into a butterfly; munches leaves
🦋|butterfly|colourful wings; flutters; was a caterpillar
🐌|snail|very slow; carries its shell; slime
🐞|ladybird/ladybug|red with black spots; beetle; lucky
🐜|ant|tiny worker; colony; marches in a line
🕷️|spider|eight legs; spins a web; creepy
🦂|scorpion|stinger on its tail; desert; pincers
🐢|turtle/tortoise|shell; slow; reptile
🐍|snake/serpent|slithers; hisses; no legs
🦎|lizard/gecko|reptile; climbs walls; drops its tail
🦖|dinosaur/rex|extinct; tiny arms; Jurassic
🐙|octopus|eight arms; squirts ink; sea
🦑|squid|tentacles; ink; calamari
🦀|crab|walks sideways; pincers; beach
🐡|blowfish/pufferfish|puffs up; spiky ball; poisonous
🐠|fish|coral reef; aquarium; fins
🐬|dolphin|clicks; very clever; flipper
🐳|whale|biggest animal; spouts water; ocean giant
🦈|shark|fin above the water; Jaws; sharp teeth
🐊|crocodile/alligator|snapping jaws; swamp; tears
🐆|leopard/cheetah|spots; very fast; big cat
🦓|zebra|stripes; black and white; savanna
🦍|gorilla/ape|beats its chest; silverback; King Kong
🐘|elephant|trunk; tusks; never forgets
🦒|giraffe|long neck; tallest animal; spots
🦘|kangaroo|pouch; hops; Australia
🐪|camel|hump; desert; ship of the desert
🦔|hedgehog|spines; rolls into a ball; Sonic
🐿️|squirrel|gathers nuts; bushy tail; climbs trees
🦜|parrot|talks; colourful; sits on a pirate's shoulder
🦢|swan|graceful; white; glides on a lake
🦚|peacock|fans its tail; feathers with eyes; national bird of India
🐓|rooster/cockerel|crows at dawn; farm; comb on its head
🦃|turkey|gobble; Thanksgiving; wattle
🐑|sheep/lamb|wool; baa; flock
🐐|goat|horns; climbs rocks; beard
🦌|deer/reindeer|antlers; Bambi; forest
🦙|llama/alpaca|spits; Peru; woolly
🦛|hippo/hippopotamus|huge mouth; river; Africa
🦏|rhino/rhinoceros|horn on its nose; thick skin; charges
🦡|badger|digs; striped face; burrow`,
		food: `
🍎|apple|red fruit; keeps the doctor away; orchard
🍌|banana|yellow; peel it; monkeys love it
🍇|grapes/grape|bunch; vine; raisins
🍉|watermelon/melon|green outside, red inside; black seeds; summer
🍓|strawberry|red; seeds on the outside; with cream
🍒|cherries/cherry|a pair on stems; red; cake topping
🍑|peach|fuzzy skin; stone fruit; orange-pink
🍍|pineapple|spiky crown; tropical; yellow inside
🥭|mango|king of fruits; summer; aam
🥥|coconut|hairy shell; palm tree; water inside
🥝|kiwi|fuzzy brown; green inside; New Zealand
🍋|lemon/lime|very sour; yellow; squeeze it
🍊|orange/tangerine|citrus; juice; peel it
🍐|pear|green fruit; bell shaped; juicy
🥑|avocado|guacamole; big seed; green
🍆|aubergine/eggplant/brinjal|purple vegetable; baingan; shiny
🥕|carrot|orange root; rabbits love it; good for your eyes
🌽|corn/maize|cob; yellow kernels; butter
🥦|broccoli|looks like a tiny tree; green; vegetable
🍄|mushroom/toadstool|fungus; pizza topping; grows in the forest
🥔|potato|mash; underground; chips
🌶️|chilli/chili/pepper|hot; spicy; mirchi
🥒|cucumber|salad; cool; pickle
🍅|tomato|red; ketchup; salad
🍞|bread/loaf|slices; toast; bakery
🥐|croissant|French; buttery; crescent
🥖|baguette|French; long and crusty; bakery
🥨|pretzel|twisted; salty; Germany
🧀|cheese|mice love it; holes; dairy
🥚|egg|shell; yolk; a hen laid it
🍳|fried egg/frying pan|breakfast; sizzle; sunny side up
🥞|pancakes/pancake|stack; syrup; flip it
🥓|bacon|crispy strips; from a pig; breakfast
🍔|burger/hamburger|bun; patty; fast food
🍟|fries/chips|potato sticks; ketchup; fast food
🍕|pizza|slice; cheese; Italy
🌭|hot dog|sausage; bun; ballpark
🥪|sandwich|two slices; lunch; filling
🌮|taco|Mexico; crunchy shell; folded
🌯|burrito/wrap|Mexico; rolled up; tortilla
🥗|salad|leaves; bowl; healthy
🍝|spaghetti/pasta|noodles; Italy; meatballs
🍜|noodles/ramen|slurp; bowl; chopsticks
🍛|curry|rice and gravy; spicy; India
🍣|sushi|raw fish; Japan; rice roll
🍱|bento|lunch box; Japan; compartments
🥟|dumpling/momo|steamed; filled; dim sum
🍙|rice ball/onigiri|triangle; seaweed; Japan
🍚|rice|bowl; white grains; chawal
🍦|ice cream/soft serve|cone; cold; swirl
🍩|doughnut/donut|hole in the middle; glazed; sprinkles
🍪|cookie/biscuit|baked; chocolate chips; dunk it in milk
🎂|cake/birthday|candles; party; make a wish
🧁|cupcake|small; frosting; muffin
🍫|chocolate|cocoa; bar; sweet
🍬|candy/sweet|wrapper; sugar; treat
🍭|lollipop|on a stick; swirl; lick
🍯|honey|bees make it; jar; sticky
🍿|popcorn|movies; butter; pops
🥛|milk|glass; white; from a cow
☕|coffee/tea|hot cup; caffeine; morning
🍹|cocktail/mocktail|little umbrella; tropical drink; party
🧂|salt|shaker; sprinkle; seasoning
🥜|peanuts/peanut|shell; elephants love them; butter`,
		things: `
⌚|watch/wristwatch|wrist; tells the time; strap
📱|phone/mobile|call; screen; apps
💻|laptop/computer|keyboard; screen; work
⌨️|keyboard|keys; typing; letters
📷|camera|photos; click; lens
📺|television/tv|channels; remote; screen
📻|radio|music; antenna; stations
⏰|alarm clock/clock|wakes you up; rings; morning
💡|light bulb/bulb|idea; glows; switch it on
🔦|torch/flashlight|in the dark; batteries; beam
🕯️|candle|wax; flame; birthday
🔑|key|lock; door; opens
🔒|lock/padlock|key; secure; closed
🔨|hammer|nails; bang; tool
🔧|spanner/wrench|bolts; tool; plumber
✂️|scissors|cut; paper; two blades
📏|ruler/scale|measure; straight line; centimetres
✏️|pencil|write; eraser; sharpener
🖊️|pen|ink; write; click
📌|pin/pushpin/drawing pin|noticeboard; sharp; stick it up
📎|paperclip/paper clip|documents; bent wire; office
📚|books/book|read; library; pages
✉️|envelope/letter|post; stamp; mail
📦|box/parcel/package|delivery; cardboard; ship it
🎁|gift/present|wrapped; ribbon; birthday
🎈|balloon|float; pop; party
🧸|teddy bear/teddy|soft toy; hug; cuddly
🛏️|bed|sleep; pillow; blanket
🛁|bathtub/bath/tub|bubbles; soak; tap water
🚿|shower|water spray; bathroom; wash
🚽|toilet/loo|flush; bathroom; seat
🧻|toilet paper/tissue|roll; soft; bathroom
🧼|soap|bubbles; wash your hands; bar
🧹|broom|sweep; witch; floor
🧺|basket|laundry; picnic; woven
🛒|shopping cart/trolley/cart|supermarket; wheels; groceries
👓|glasses/spectacles/specs|see better; lenses; eyes
🕶️|sunglasses/shades|sunny; cool; dark lenses
👑|crown|king; queen; gold
💍|ring|finger; diamond; wedding
👟|shoe/sneaker/trainer|foot; laces; running
👠|high heel/heels|tall; fashion; stiletto
👒|sun hat/hat|head; straw; brim
🎩|top hat|magician; tall; formal
🧢|cap|baseball; peak; head
👕|t-shirt/shirt/tee|cotton; wear; sleeves
👖|jeans/trousers/pants|denim; blue; legs
👗|dress/frock|party; wear; skirt
🧦|socks/sock|feet; pair; drawer
🧤|gloves/glove|hands; winter; warm
🧣|scarf|neck; winter; wool
☂️|umbrella|rain; open it; stay dry
🎒|backpack/bag/schoolbag|school; straps; carry
👜|handbag/purse|carry; strap; fashion
💰|money bag/money|cash; rich; dollar sign
💎|diamond/gem|sparkle; jewel; precious
🧲|magnet|attracts; metal; north and south
🔋|battery|charge; power; AA
🧯|fire extinguisher|red; foam; emergency
🧭|compass|north; direction; needle
⏳|hourglass/sand timer|grains falling; time; turn it over
🔔|bell|ring; ding dong; church
🔭|telescope|stars; lens; astronomer
🔬|microscope|tiny things; lab; lens
💊|pill/medicine/tablet|doctor; swallow; capsule
🧷|safety pin|nappy; clasp; sharp`,
		play: `
⚽|football/soccer|goal; kick; FIFA
🏀|basketball|hoop; dribble; NBA
🏈|american football/rugby|oval ball; touchdown; helmet
⚾|baseball|bat; pitcher; home run
🎾|tennis|racket; court; Wimbledon
🏐|volleyball|net; beach; spike
🏏|cricket|bat; wicket; sixer
🏓|table tennis/ping pong|paddle; small ball; net
🏸|badminton|shuttlecock; racket; net
🥊|boxing/boxing glove|punch; ring; knockout
🥋|karate/martial arts/judo|black belt; kick; dojo
⛳|golf|hole; flag; putt
⛸️|ice skating/skate|rink; blades; figure
🎿|skiing/ski|snow; slope; poles
🏂|snowboard|slope; one plank; winter sport
🏄|surfing/surf|waves; board; beach
🏊|swimming/swim|pool; strokes; goggles
🚴|cycling/cyclist|pedal; helmet; race
🏋️|weightlifting/weights|barbell; gym; heavy
🤸|cartwheel/gymnastics|flip; acrobat; somersault
🎯|darts/dart/bullseye|target; throw; pub
🎳|bowling|pins; strike; lane
🎱|pool/billiards/snooker|cue; black ball; pocket
🎮|video game/controller|console; play; buttons
🕹️|joystick|arcade; lever; retro game
🎲|dice/die|roll; six sides; board game
🧩|jigsaw/puzzle|pieces; fit together; picture
♟️|chess|king; checkmate; pawn
🃏|joker/playing card|deck; wild; clown
🎸|guitar|strings; strum; rock
🎹|piano/keyboard|keys; black and white; Mozart
🎺|trumpet|brass; blow; jazz
🎻|violin|bow; strings; orchestra
🥁|drum/drums|beat; sticks; rhythm
🎷|saxophone/sax|jazz; reed; curved
🎤|microphone/mic|sing; karaoke; stage
🎧|headphones/headset|ears; music; listen
🎬|clapperboard/movie/film|action; cut; director
🎨|palette/painting/paint|artist; brush; colours
🎭|theatre/drama|comedy and tragedy; stage; actors
🎪|circus|clown; big top; acrobats
🎡|ferris wheel|fair; ride; London Eye
🎢|roller coaster|loop; scream; theme park
🎠|carousel/merry-go-round|horses; spin; fair
🛹|skateboard|wheels; tricks; ramp
🛷|sled/sledge|snow; slide; winter
🏆|trophy/cup|winner; gold; prize
🥇|gold medal/medal|first place; Olympics; winner
🧗|climbing/climber|rock wall; rope; harness
🎣|fishing|rod; hook; catch
🏹|bow and arrow/archery|target; string; Robin Hood`,
		travel: `
🚗|car|drive; wheels; road
🚕|taxi/cab|yellow; fare; hail it
🚌|bus|stop; passengers; route
🚑|ambulance|siren; hospital; emergency
🚒|fire engine/fire truck|ladder; siren; red
🚓|police car|siren; cops; patrol
🚜|tractor|farm; field; plough
🏎️|racing car/race car|fast; Formula 1; track
🏍️|motorbike/motorcycle|two wheels; helmet; vroom
🛵|scooter|two wheels; Vespa; ride
🚲|bicycle/bike/cycle|pedals; two wheels; bell
🚂|steam train/train/locomotive|chugging; tracks; smoke
🚇|metro/subway/underground|station; tunnel; tube
🚁|helicopter|rotor; hover; chopper
✈️|aeroplane/airplane/plane|fly; wings; airport
🚀|rocket|space; launch; blast off
🛸|flying saucer/ufo|aliens; spaceship; disc
⛵|sailboat/boat|wind; mast; sea
🚢|ship/liner|ocean; captain; cruise
⚓|anchor|ship; heavy; sea floor
🛶|canoe/kayak|paddle; river; narrow
🚦|traffic light/signal|red amber green; stop; junction
⛽|petrol pump/fuel|fill up; station; diesel
🗺️|map|directions; atlas; paper
🧳|suitcase/luggage|travel; pack; wheels
🏠|house/home|live; roof; family
🏰|castle|king; tower; moat
🏯|pagoda/japanese castle|Japan; tiers; temple
🗽|statue of liberty|New York; torch; green lady
🗿|moai/stone head|Easter Island; giant face; statue
🏛️|museum/columns|Greece; history; marble
🕌|mosque|dome; minaret; prayer
⛪|church|bells; cross; Sunday
🏥|hospital|doctor; nurse; sick
🏫|school|class; teacher; students
🏦|bank|money; vault; ATM
🏪|shop/store|buy; open late; groceries
🏭|factory|smoke; workers; machines
🏟️|stadium|match; crowd; seats
⛺|tent|sleeping bag; outdoors; pegs
🌉|bridge|river crossing; Golden Gate; span
🎆|fireworks/firework|bang; sky; Diwali
🏖️|beach|sand; umbrella; sea
🏝️|island|palm tree; surrounded by water; castaway
🌋|volcano|lava; eruption; mountain
🏔️|mountain|peak; snow; climb
🏜️|desert|sand dunes; cactus; hot
🗻|mount fuji/fuji|Japan; snowy cap; volcano
⛲|fountain|water spray; park; coins
🛤️|railway/railway track|rails; train; sleepers
🏙️|city/skyline|buildings; skyscrapers; urban
🛰️|satellite|orbit; space; signal
🚏|bus stop|wait; sign; timetable`,
		nature: `
☀️|sun|hot; daytime; shines bright
🌙|moon/crescent|night; stars; werewolf
⭐|star|twinkle; night sky; five points
☁️|cloud|sky; fluffy; white
🌧️|rain|wet; umbrella; drops
⛈️|thunderstorm/storm|lightning; dark clouds; loud
⚡|lightning|flash; storm; electric
❄️|snowflake/snow|cold; winter; unique
⛄|snowman|carrot nose; winter; frosty
🌈|rainbow|seven colours; pot of gold; arc in the sky
🌪️|tornado/twister|spinning wind; storm; funnel
🌊|wave/ocean|surf; sea; tide
🔥|fire/flame|hot; burn; smoke
💧|drop/droplet/water drop|wet; tear; drip
🌍|earth/globe/world|planet; continents; home
☄️|comet|tail; space; shooting
🌡️|thermometer|temperature; fever; hot or cold
🌱|seedling/sprout|grows; new life; plant it
🌳|tree|leaves; trunk; forest
🌲|pine tree/fir|evergreen; needles; cones
🌴|palm tree/palm|beach; coconuts; tropical
🌵|cactus|desert; prickly; succulent
🌷|tulip|Holland; spring; bulb
🌹|rose|red; thorns; Valentine
🌻|sunflower|yellow; seeds; very tall
🌼|daisy/flower|white petals; meadow; he loves me
🌸|cherry blossom/sakura|Japan; pink; spring
🍁|maple leaf/maple|Canada; autumn; syrup
🍂|fallen leaves/autumn leaves|crunchy; rake; brown
🍀|four leaf clover/clover|luck; Ireland; green
🌾|wheat/rice plant|harvest; grain; field
🌰|chestnut|roast; brown; conker
🐚|shell/seashell|beach; hear the ocean; spiral
🌅|sunrise/sunset|morning; dawn; horizon
🌌|milky way/galaxy|stars; space; night sky
🌕|full moon|round; night; werewolf
🌫️|fog/mist|can't see; grey; morning
💨|wind/gust|blow; breeze; whoosh
🦠|germ/microbe/virus|tiny; sick; bacteria
🕸️|spider web/cobweb|sticky; Halloween; catches flies
🌿|herb|green; leaves; cooking
🥀|wilted flower|dying; drooping; sad
🌺|hibiscus|tropical flower; red; Hawaii`,
	};

	const NAMES = { animals: "Animals", food: "Food", things: "Things", play: "Sport & play", travel: "Travel & places", nature: "Nature & sky" };

	/** Words that join a name's words ("bow and arrow"), never names themselves. */
	const JOINING = new Set(["and", "the", "for", "with", "off"]);
	/** Every picture: { key, cat, e, name, names, words, squash, clues }. `words` and `squash`: what a clue may not say. */
	const ALL = [];
	for (const [cat, text] of Object.entries(RAW)) {
		for (const line of text.trim().split("\n")) {
			const [e, names, clues] = line.split("|").map((x) => x.trim());
			const list = names.split("/").map((x) => x.trim());
			// What a clue may not say: each word of each name, whole (joining
			// words like "and" left out), and — for the long ones — the name run
			// together, so "e l e p h a n t" is caught but "rainbow" is not "bow".
			const words = [...new Set(list.flatMap((n) => n.toLowerCase().split(/[^a-z]+/)).filter((w) => w.length >= 3 && !JOINING.has(w)))];
			const squash = [...new Set([...words, ...list.map((n) => n.toLowerCase().replace(/[^a-z]/g, ""))].filter((w) => w.length >= 5))];
			ALL.push({ key: `${cat}:${e}`, cat, e, name: list[0], names: list, words, squash, clues: clues.split(";").map((x) => x.trim()) });
		}
	}
	const CATEGORIES = Object.keys(RAW).map((id) => ({ id, name: NAMES[id], count: ALL.filter((p) => p.cat === id).length }));

	globalThis.guessWhatPictures = { ALL, CATEGORIES };
})();
