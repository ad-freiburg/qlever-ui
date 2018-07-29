sample1 = `PREFIX fb: <http://rdf.freebase.com/ns/>
SELECT ?person ?name TEXT(?c) SCORE(?c) WHERE {
  ?person fb:people.person.profession ?profession .
  ?profession fb:type.object.name "Astronaut"@en .
  ?person fb:type.object.name ?name .
  ?c ql:contains-entity ?person .
  ?c ql:contains-word walk* moon
 
}
LIMIT 100
ORDER BY DESC(SCORE(?c))`;

sample2 = `PREFIX fb: <http://rdf.freebase.com/ns/>
SELECT DISTINCT ?cityname ?countryname ?populationnumber ?lat ?long WHERE {
  ?city fb:type.object.type fb:location.citytown .
  ?city fb:location.location.containedby ?country .
  ?city fb:location.statistical_region.population ?population .
  ?country fb:type.object.type fb:location.country .
  ?city fb:type.object.name ?cityname .
  ?country fb:type.object.name ?countryname .
  ?population fb:measurement_unit.dated_integer.number ?populationnumber .
  ?city fb:location.location.geolocation ?geolocation .
  ?geolocation fb:location.geocode.latitude ?lat .
  ?geolocation fb:location.geocode.longitude ?long .
  
}`;
