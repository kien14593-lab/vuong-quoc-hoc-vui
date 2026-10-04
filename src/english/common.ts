/**
 * Từ tiếng Anh thông dụng (ngắn). Dùng để loại các "từ sai chính tả" hay chữ thay thế vô tình
 * thành một từ có thật (ví dụ c_t → "cut", "cot"), để câu hỏi không có hai đáp án.
 */
const LIST = `
a about above across act add after again age ago aid aim air all also always am an and angry animal ankle another answer ant any ape apple are area arm army around art as ask at ate away awake axe
baby back bad bag bake ball band bang bank bar bark barn base bat bath be beach bead beak beam bean bear beat bed bee beef been beer beg begin behind bell belt bench bend best bet better big bike bill bin bird birth bit bite black blade blank blew blind block blood blow blue board boat body boil bold bone book boot born boss both bottle bottom bow bowl box boy brain brave bread break brick bride bring broke brown brush bud bug build built bull bump bun bunch bus bush busy but butter buy buzz by
cab cage cake call calm came camp can cane cap cape car card care carpet carry cart case cash cast cat catch cave cell cent chain chair chalk chap chase chat cheap check cheek cheer chess chest chick chief child chill chin chip chop city clap class claw clay clean clear clever cliff climb clip clock close cloth cloud clown club coach coal coast coat cod code coin cold colour comb come cone cook cool cop copy cord core cork corn cost cot cotton couch cough could count cow crab crack crash crawl cream crew crib crop cross crow crowd crown cry cub cube cup cure curl cut cute
dad dam damp dance dare dark dart dash date day dead deaf deal dear deck deep deer den dent desk dew dial did die dig dim dine dinner dip dirt dish dive do dock does doll done door dot dove down doze drag draw dream dress drew drill drink drip drive drop drum dry duck dug dull dump dust duty
each eagle ear early earn earth east easy eat edge egg eight else end even ever every evil eye
face fact fade fail fair fake fall fame fan far farm fast fat fate feed feel feet fell felt fern few fig fight fill film find fine fire firm first fish fist fit five fix flag flame flap flat flip float flock floor flow flu fly foam fog fold folk food fool foot for fork form fort fox free fresh frog from front frost fruit full fun fur
gain game gap gas gate gave gaze gear gem get ghost gift girl give glad glass glow glue go goal goat god gold golf gone good goose got grab grade grain grand grape grass grave gray great green grew grey grin grip grow grub gulp gum gun gut guy
had hail hair half hall ham hand hang happy hard hare harm has hat hate have hay he head heal heap hear heart heat heel held hello help hen her herd here hero hid hide high hike hill him hint hip his hit hive hold hole home honey hood hoof hook hop hope horn horse hose host hot hour house how hug huge hum hump hunt hurt hut
ice icy idea if ill in inch ink into iron is it its
jam jar jaw jelly jet job jog join joke joy judge jug juice jump just
keen keep kept key kick kid kill kind king kiss kit kite knee knew knife knit knob knock knot know
lab lace lad lady laid lake lamb lamp land lane lap large last late laugh law lawn lay lazy lead leaf leak lean leap learn left leg lemon lend less let lick lid lie life lift light like lily lime line lion lip list live load loaf lock log long look loop lose loss lost lot loud love low luck lucky lump lunch
mad made maid mail main make male man many map mark mask mat match mate may me meal mean meat meet melt men mend mess met mice mild milk mill mind mine mint miss mist mix moan mob mole mom money monk month moon mop more moss most moth mouse mouth move much mud mug mule mum must my
nail name nap neat neck need nest net never new news next nice night nine no nod noise none noon nor nose not note now nut
oak oar odd of off oil old on once one only open or orange our out oven over owl own
pace pack pad page paid pail pain paint pair pal palm pan pant park part pass past pat path paw pay pea peach peak pear peel peg pen penny pest pet pick pie piece pig pile pill pin pine pink pint pipe pit place plan plane plant plate play plot plug plum plus pod poem point pole pond pony pool poor pop pork port post pot pour powder press price pride prize pull pump punch pup pupil purse push put
quack queen quick quiet quilt quit quiz
race rack rag rain raise rake ram ran rang rat raw ray reach read real red rent rest rib rice rich rid ride ring rip ripe rise road roar rob rock rod rode role roll roof room root rope rose rot rough round row rub rug rule run rush rust
sack sad safe said sail salt same sand sang sank sat sauce save saw say scale scarf school sea seal seat see seed seek seem seen self sell send sent set seven shade shake shape share shark sharp shed sheep sheet shelf shell shine ship shirt shoe shook shop shore short shot should shout show shut shy sick side sign silk sing sink sip sir sit six size skate ski skin skip skirt sky slap sled sleep slid slide slim slip slot slow small smell smile smoke snack snail snake snow so soap sock sofa soft soil sold some son song soon sore sort sound soup south space spade spin spoon spot spray square stamp stand star start stay steam steel step stick still sting stir stone stood stop store storm story stove straw street string strong such sugar suit sum sun sure swan sweet swim swing
tab table tail take tale talk tall tame tan tank tap tape tar task taste taught tea teach team tear teeth tell ten tent term test than thank that the them then there these they thick thin thing think this those three threw throw thumb tick tide tie tiger tight tile till time tin tiny tip tired to toad toast toe told tom ton tone too took tool tooth top torch tore toss touch tour town toy track trap tray tree trick trip truck true trunk try tub tube tug tune turn twin two
ugly under unit up upon us use
van vase very vest vet view vine visit voice vote
wag wait wake walk wall wand want war warm was wash wasp watch water wave wax way we weak wear web week weed well went were west wet whale what wheat wheel when where which while whip white who whole why wide wife wig wild will win wind wing wink wipe wise wish with woke wolf won wood wool word wore work world worm would wrap write wrong
yak yam yard yarn yawn year yell yes yet you young your
zap zero zip zoo
`;

/**
 * Chuỗi có trong một từ điển tiếng Anh lớn (kể cả từ hiếm, tên riêng, từ cổ) mà quy tắc tạo lỗi chính tả
 * hoặc đảo chữ có thể sinh ra từ các từ trong ngân hàng. Lập khi soạn bằng cách so mọi "từ viết sai"
 * với danh sách từ điển công cộng; nên kiểm tra lại khi thêm nhiều từ mới.
 */
const EXTRA = `
abby aer aes aet ahir aht amp aplace avn aye ayes baar bae baht bal bde bea beech bel beth bid bleu boost bos
bota bouts brae brava bravi breed breva breve brid buys cafe cen cep chaco cheep chere chet cire clape claver
cliver clod cloes clos cluck colk coul couth cpu curn cwo deb demal der dink disk dol dour eer eg eh en envelop
era erd erst eta expansive eyas fac faery feal fer fere fin fini fir fiver flet flour fluor fogy fon fra fram
framer friand frug furs gab gam gander gandering gaol gel gib gink gins gip glob goel gola goodby grandam grein
ha haed hallo halp han harre heed heir hend hera herat het hillo hin hors hubby inne kale kay kend kibe kye lag
lak lama latter leef leon leve levi lig lino lisp litter liv lod loin louk lung lurer lwo maat mage mane melon
menus meta minos mite mna mono moose mooth moues moun moyen muon myg nabk nair nairy nam nama nat nav naw neer
nema nene nep nett newt ni nife nina noes norse nos nowt nu nuder nus odor offic op orad orang paar pac pam
paste peer penda penk perk phis phos pia plat plena polit princes pte pu puls quean queet quite rabbet rad rani
reap reeding rein rets rever ric rife rist robber roed roes ron rood ros rosa rotch rowet rummes ruse saa sae
sawn scouter selt sert sey sha shall shel shi shill sia signer signing skat skete slain slat slime slup snaw
snig snoop sone sonny spacial spall speel speeling spill spreng stake staking ster stirk stra stroy strung sub
sweats taa tae tal tee teem teer tema tiam tigger tike tim tint toady toag traist tried troch tsar tun tuna umm
un unred urn ux vile vitis wab wen wendy weve whit wint women writ xis yas yee yees yis yob
blacks choir corking fane feat frat groin kink maintain noose rate stab twee
`;

/** Từ không phù hợp với trẻ em – không bao giờ được tạo ra (mã hoá ROT13 để mã nguồn sạch). */
const BLOCKED_ROT13 = 'frk frkl fhk fhpx fhpxf crr crrf crrq cbb cbbc cvff sneg snegf ohgg ohggf ohz ohzf nff nefr qvpx qvpxf pbpx gvg gvgf obbo obbof penc fuvg shpx qnza uryy ahqr cbea ovgpu phag fyhg juber snt anmv encr qeht qehtf orre jvar jrrq obbmr obat chxr gjng jnax cevpx chor chorf nahf nany cravf ubeal cvzc qbcr pbxr zrgu tva ehz ibzvg fung funt gheq phz wvmm uber fchax fxnax cbbs oybbql jnaxre onfgneq gbffre';
const rot13 = (s: string) => s.replace(/[a-z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - 97 + 13) % 26) + 97));
export const BLOCKED: ReadonlySet<string> = new Set(BLOCKED_ROT13.split(' ').map(rot13));

export const COMMON: ReadonlySet<string> = new Set([...LIST.split(/\s+/), ...EXTRA.split(/\s+/), ...BLOCKED].filter(Boolean));
