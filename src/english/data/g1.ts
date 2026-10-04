/**
 * Từ vựng Lớp 1, xếp theo 16 Unit (chủ đề bám theo bộ "Tiếng Anh Global Success").
 * Chỉ dùng tên chủ đề và từ thông dụng; nghĩa, câu ví dụ và hình đều do nhóm tự soạn (emoji).
 *
 * Mỗi dòng: từ|nghĩa tiếng Việt|emoji|nhãn chủ đề|thêm…
 * Thêm: np = không dùng cho câu hỏi hình; pw = từ vốn ở số nhiều; nc = không đếm được;
 * pl=… số nhiều bất quy tắc; alt=… từ đồng nghĩa; grp=… nhóm dễ nhầm (không làm phương án nhiễu
 * cho nhau); m / f = người nam / nữ; hex=… mã màu; ex=… câu ví dụ.
 */
export const G1: string[] = [
  // 1 In the school playground (b)
  `ball|quả bóng|🏀|toy|grp=ball
bag|cái cặp|🎒|school
bike|xe đạp|🚲|transport,toy
book|quyển sách|📖|school
bird|con chim|🐦|animal
bee|con ong|🐝|animal
boy|cậu bé|👦|people|m
banana|quả chuối|🍌|fruit,food
balloon|quả bóng bay|🎈|toy|grp=ball
kite|cái diều|🪁|toy
girl|cô bé|👧|people|f
tree|cái cây|🌳|nature`,

  // 2 In the dining room (c)
  `cake|bánh ga-tô|🎂|food
cup|cái cốc|☕|kitchen
cookie|bánh quy|🍪|food
carrot|củ cà rốt|🥕|veg,food
corn|bắp ngô|🌽|veg,food|nc
cat|con mèo|🐱|animal
plate|cái đĩa|🍽️|kitchen
spoon|cái thìa|🥄|kitchen
bowl|cái bát|🥣|kitchen
milk|sữa|🥛|drink|nc
bread|bánh mì|🍞|food|nc
egg|quả trứng|🥚|food`,

  // 3 At the street market (a)
  `apple|quả táo|🍎|fruit,food
ant|con kiến|🐜|animal
avocado|quả bơ|🥑|fruit,food
orange|quả cam|🍊|fruit,food
mango|quả xoài|🥭|fruit,food|pl=mangoes
grapes|quả nho|🍇|fruit,food|pw
lemon|quả chanh|🍋|fruit,food
tomato|quả cà chua|🍅|veg,food|pl=tomatoes
potato|củ khoai tây|🥔|veg,food|pl=potatoes
hat|cái mũ|👒|clothes`,

  // 4 In the bedroom (d)
  `door|cửa ra vào|🚪|home
dog|con chó|🐶|animal
duck|con vịt|🦆|animal
drum|cái trống|🥁|toy,music
dress|cái váy|👗|clothes
dinosaur|con khủng long|🦕|toy,animal
dad|bố|👨|family|m|alt=father
bed|cái giường|🛏️|home
clock|đồng hồ|⏰|home
socks|đôi tất|🧦|clothes|pw`,

  // 5 At the fish and chip shop (i)
  `fish|con cá|🐟|animal,food|pl=fish
chips|khoai tây chiên|🍟|food|pw
chicken|thịt gà|🍗|food|nc
drink|đồ uống|🥤|drink
pizza|bánh pi-za|🍕|food
sandwich|bánh mì kẹp|🥪|food
juice|nước ép|🧃|drink|nc
salt|muối|🧂|food|nc
ice cream|kem|🍦|food|nc
fork|cái nĩa|🍴|kitchen`,

  // 6 In the classroom (e)
  `pen|bút mực|🖊️|school|grp=pen
pencil|bút chì|✏️|school|grp=pen
bell|cái chuông|🔔|school
elephant|con voi|🐘|animal
envelope|phong bì|✉️|home
teacher|cô giáo|👩‍🏫|people,job|f
chair|cái ghế|🪑|home,school
computer|máy tính|💻|school,home
ruler|thước kẻ|📏|school
scissors|cái kéo|✂️|school|pw
crayon|bút sáp màu|🖍️|school|grp=pen`,

  // 7 In the garden (g)
  `goat|con dê|🐐|animal
guitar|đàn ghi-ta|🎸|music,toy
gift|món quà|🎁|toy|alt=present
grandma|bà|👵|family|f|alt=grandmother
grandpa|ông|👴|family|m|alt=grandfather
flower|bông hoa|🌸|nature
butterfly|con bướm|🦋|animal
snail|con ốc sên|🐌|animal
sun|mặt trời|☀️|nature,weather
leaf|chiếc lá|🍃|nature|pl=leaves
ladybird|con bọ rùa|🐞|animal`,

  // 8 In the park (h)
  `horse|con ngựa|🐴|animal
hen|con gà mái|🐔|animal
hand|bàn tay|✋|body
house|ngôi nhà|🏠|place,home
helicopter|máy bay trực thăng|🚁|transport
hippo|con hà mã|🦛|animal
hedgehog|con nhím|🦔|animal
heart|trái tim|❤️|shape
hot dog|bánh mì xúc xích|🌭|food
honey|mật ong|🍯|food|nc`,

  // 9 In the shop (o)
  `shop|cửa hàng|🏪|place
box|cái hộp|📦|home
lollipop|kẹo mút|🍭|food
robot|người máy|🤖|toy
popcorn|bỏng ngô|🍿|food|nc
chocolate|sô-cô-la|🍫|food|nc
octopus|con bạch tuộc|🐙|animal
fox|con cáo|🦊|animal
money|tiền|💵|word|nc
basket|cái giỏ|🧺|home`,

  // 10 At the zoo (m)
  `monkey|con khỉ|🐒|animal
mouse|con chuột|🐭|animal|pl=mice
moon|mặt trăng|🌙|nature
map|bản đồ|🗺️|school
mum|mẹ|👩|family|f|alt=mother
lion|con sư tử|🦁|animal
tiger|con hổ|🐯|animal
zebra|con ngựa vằn|🦓|animal
giraffe|con hươu cao cổ|🦒|animal
bear|con gấu|🐻|animal
snake|con rắn|🐍|animal`,

  // 11 At the bus stop (u)
  `bus|xe buýt|🚌|transport|grp=bus
bus stop|bến xe buýt|🚏|place|grp=bus
umbrella|cái ô|☂️|home
car|ô tô|🚗|transport
taxi|xe tắc-xi|🚕|transport
motorbike|xe máy|🏍️|transport
nut|hạt dẻ|🌰|food
run|chạy|🏃|action
sunglasses|kính râm|🕶️|clothes|pw
up|lên trên|⬆️|word`,

  // 12 At the lake (l)
  `lake|cái hồ|🏞️|place,nature
lizard|con thằn lằn|🦎|animal
lock|ổ khóa|🔒|home
leg|cái chân|🦵|body
lips|đôi môi|👄|body|pw
llama|con lạc đà không bướu|🦙|animal
frog|con ếch|🐸|animal
boat|con thuyền|⛵|transport
swan|con thiên nga|🦢|animal
water|nước|💧|drink,nature|nc`,

  // 13 In the school canteen (n)
  `noodles|mì sợi|🍜|food|pw
nose|cái mũi|👃|body
nine|số chín|9️⃣|number
notebook|quyển vở|📓|school
number|con số|🔢|school
rice|cơm|🍚|food|nc
soup|món súp|🍲|food|nc
lunch|bữa trưa|🍱|food|nc
salad|món sa-lát|🥗|food|nc`,

  // 14 In the toy shop (t)
  `teddy bear|gấu bông|🧸|toy
train|tàu hỏa|🚂|transport,toy
ten|số mười|🔟|number
tortoise|con rùa|🐢|animal|alt=turtle
trumpet|cái kèn|🎺|music,toy
tractor|máy cày|🚜|transport,toy
puzzle|trò ghép hình|🧩|toy
plane|máy bay|✈️|transport,toy
rocket|tên lửa|🚀|toy,transport
dice|xúc xắc|🎲|toy|pl=dice`,

  // 15 At the football match (f)
  `football|quả bóng đá|⚽|sport,toy
flag|lá cờ|🚩|sport
foot|bàn chân|🦶|body|pl=feet
face|khuôn mặt|🙂|body
five|số năm|5️⃣|number
four|số bốn|4️⃣|number
goal|khung thành|🥅|sport
trophy|chiếc cúp|🏆|sport
medal|huy chương|🏅|sport
shirt|cái áo|👕|clothes`,

  // 16 At home (w)
  `watch|đồng hồ đeo tay|⌚|home
web|mạng nhện|🕸️|nature
whale|cá voi|🐳|animal
wolf|con sói|🐺|animal|pl=wolves
wave|vẫy tay|👋|action
sofa|ghế sô-pha|🛋️|home
bath|bồn tắm|🛁|home
toilet|nhà vệ sinh|🚽|home
baby|em bé|👶|family|pl=babies
key|chìa khóa|🔑|home`,
];
